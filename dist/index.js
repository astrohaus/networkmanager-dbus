"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NetworkManager = void 0;
const dbus_1 = __importDefault(require("dbus"));
const rxjs_1 = require("rxjs");
const uuid_1 = require("uuid");
const dbus_types_1 = require("./dbus-types");
class NetworkManager {
    // public connectedAccessPoint: Observable<AccessPoint>;
    constructor(networkManagerInterface, settingsInterface, wifiDeviceInterface, wifiDevicePath, initialConditions) {
        this._networkManagerInterface = networkManagerInterface;
        this._settingsInterface = settingsInterface;
        this._wifiDeviceInterface = wifiDeviceInterface;
        this._wifiDevicePath = wifiDevicePath;
        this._savedWpaConnections = initialConditions.savedWpaConnections;
        this._networkManagerProperties = initialConditions.networkManagerProperties;
        this._networkManagerPropertiesSubject = new rxjs_1.BehaviorSubject(this._networkManagerProperties);
        this.networkManagerProperties$ = this._networkManagerPropertiesSubject.asObservable();
        this._accessPoints = initialConditions.discoveredAccessPoints;
        this._accessPointsSubject = new rxjs_1.BehaviorSubject(Object.values(this._accessPoints));
        this.accessPoints$ = this._accessPointsSubject.asObservable();
        this._listenForNetworkManagerProperties();
        this._listenForConnectionSettings();
        this._listenForAccessPoints();
    }
    get networkManagerProperties() {
        return this._networkManagerProperties;
    }
    get accessPoints() {
        return Object.values(this._accessPoints);
    }
    static async init() {
        return new Promise(async (resolve, reject) => {
            let networkManagerInterface = await NetworkManager._getInterface('/org/freedesktop/NetworkManager', 'org.freedesktop.NetworkManager');
            let settingsInterface = await NetworkManager._getInterface('/org/freedesktop/NetworkManager/Settings', 'org.freedesktop.NetworkManager.Settings');
            let wifiDevice = await NetworkManager._wifiDevice();
            let savedWpaConnections = await NetworkManager._savedWpaConnections(settingsInterface);
            let discoveredAccessPoints = await NetworkManager._discoveredAccessPoints(wifiDevice.interface);
            let networkManagerProperties = await NetworkManager._networkManagerProperties();
            wifiDevice.interface.getProperties((err, props) => {
                console.log('wifi device properties:');
                console.log(props);
            });
            let iface = await NetworkManager._getInterface(wifiDevice.path, 'org.freedesktop.NetworkManager.Device');
            iface.getProperties((err, props) => {
                console.log('device that happens to be wifi properties:');
                console.log(props);
            });
            let knownSsids = Object.values(savedWpaConnections);
            for (const [_, accessPoint] of Object.entries(discoveredAccessPoints)) {
                if (knownSsids.includes(accessPoint.Ssid)) {
                    accessPoint.ConnectionSettingsCandidates = Object.keys(savedWpaConnections).filter((settingsPath) => savedWpaConnections[settingsPath] === accessPoint.Ssid);
                }
            }
            let initialConditions = {
                networkManagerProperties: networkManagerProperties,
                discoveredAccessPoints: discoveredAccessPoints,
                savedWpaConnections: savedWpaConnections,
            };
            let networkManager = new NetworkManager(networkManagerInterface, settingsInterface, wifiDevice.interface, wifiDevice.path, initialConditions);
            resolve(networkManager);
        });
    }
    async requestScan() {
        return new Promise(async (resolve, reject) => {
            this._wifiDeviceInterface.RequestScan({}, (err, result) => {
                if (err) {
                    reject(`Scan Error: ${err}`);
                    return;
                }
                else {
                    resolve();
                }
            });
        });
    }
    addNewWpaConnection(priority, ssid, password) {
        return new Promise((resolve, reject) => {
            let ssidByteArray = NetworkManager._stringToByteArray(ssid);
            let connectionSettings = {
                connection: {
                    type: '802-11-wireless',
                    uuid: uuid_1.v4(),
                    id: ssid,
                    autoconnect: true,
                    'autoconnect-priority': priority,
                    mdns: 2,
                },
                '802-11-wireless': {
                    mode: 'infrastructure',
                    ssid: ssidByteArray,
                    hidden: true,
                },
                '802-11-wireless-security': {
                    'key-mgmt': 'wpa-psk',
                    'auth-alg': 'open',
                    psk: password,
                },
                ipv4: {
                    method: 'auto',
                },
                ipv6: {
                    method: 'auto',
                },
            };
            this._settingsInterface.AddConnection(connectionSettings, (err, connectionSettingsPath) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(connectionSettingsPath);
                }
            });
        });
    }
    activateConnection(connectionSettingsPath, accessPointPath) {
        return new Promise((resolve, reject) => {
            this._networkManagerInterface.ActivateConnection(connectionSettingsPath, this._wifiDevicePath, accessPointPath ? accessPointPath : '/', {}, (err, activeConnectionPath) => {
                if (err) {
                    reject(`Error activating connection: ${err}`);
                    return;
                }
                resolve(activeConnectionPath);
            });
        });
    }
    wifiEnabled(enabled) {
        return new Promise((resolve, reject) => { });
    }
    ethernetEnabled(enabled) {
        return new Promise((resolve, reject) => { });
    }
    _listenForConnectionSettings() {
        this._settingsInterface.on('NewConnection', async (connectionSettingsPath) => {
            console.log(`Connection settings added: ${connectionSettingsPath}`);
            let connectionSettings = await NetworkManager._getInterface(connectionSettingsPath, 'org.freedesktop.NetworkManager.Settings.Connection');
            connectionSettings.GetSettings({}, (err, settings) => {
                if (!settings['802-11-wireless']) {
                    return;
                }
                let settingsSsid = NetworkManager._byteArrayToString(settings['802-11-wireless'].ssid);
                this._savedWpaConnections[connectionSettingsPath] = settingsSsid;
                for (const [_, accessPoint] of Object.entries(this._accessPoints)) {
                    if (accessPoint.Ssid === settingsSsid) {
                        accessPoint.ConnectionSettingsCandidates.push(connectionSettingsPath);
                    }
                }
                this._accessPointsSubject.next(Object.values(this._accessPoints));
            });
        });
        this._settingsInterface.on('ConnectionRemoved', (connectionSettingsPath) => {
            console.log(`Connection settings removed: ${connectionSettingsPath}`);
            for (const [_, accessPoint] of Object.entries(this._accessPoints)) {
                if (accessPoint.ConnectionSettingsCandidates.includes(connectionSettingsPath)) {
                    let settingsPathIndex = accessPoint.ConnectionSettingsCandidates.indexOf(connectionSettingsPath);
                    accessPoint.ConnectionSettingsCandidates.splice(settingsPathIndex, 1);
                }
            }
            this._accessPointsSubject.next(Object.values(this._accessPoints));
        });
    }
    _listenForAccessPoints() {
        this._wifiDeviceInterface.on('AccessPointAdded', async (accessPointPath) => {
            let accessPoint = await NetworkManager._accessPointProperties(accessPointPath);
            let knownSsids = Object.values(this._savedWpaConnections);
            if (knownSsids.includes(accessPoint.Ssid)) {
                accessPoint.ConnectionSettingsCandidates = Object.keys(this._savedWpaConnections).filter((settingsPath) => this._savedWpaConnections[settingsPath] === accessPoint.Ssid);
            }
            this._accessPoints[accessPointPath] = accessPoint;
            this._accessPointsSubject.next(Object.values(this._accessPoints));
        });
        this._wifiDeviceInterface.on('AccessPointRemoved', (accessPointPath) => {
            if (this._accessPoints[accessPointPath]) {
                delete this._accessPoints[accessPointPath];
            }
            this._accessPointsSubject.next(Object.values(this._accessPoints));
        });
    }
    async _listenForNetworkManagerProperties() {
        let networkManagerPropsInterface = await NetworkManager._getInterface('/org/freedesktop/NetworkManager', 'org.freedesktop.DBus.Properties');
        networkManagerPropsInterface.on('PropertiesChanged', async () => {
            this._networkManagerInterface.getProperties(async (err, properties) => {
                if (err) {
                    console.error(err);
                }
                else {
                    this._networkManagerProperties = properties;
                    this._networkManagerPropertiesSubject.next(this._networkManagerProperties);
                    console.log('active connections:');
                    // let activeConnectionInterface = await NetworkManager._getInterface(this._networkManagerProperties.PrimaryConnection, 'org.freedesktop.NetworkManager.Connection.Active');
                    // activeConnectionInterface.getProperty('Connection', async (err, result) => {
                    //     let connectionInterface = await NetworkManager._getInterface(result, 'org.freedesktop.NetworkManager.Settings.Connection');
                    //     connectionInterface.GetSettings({}, (err: any, settings: any) => {
                    //         console.log(`Settings for ${this._networkManagerProperties.PrimaryConnection}:`);
                    //         console.log(settings);
                    //     })
                    // })
                    this._networkManagerProperties.ActiveConnections.concat(this._networkManagerProperties.PrimaryConnection).forEach(async (connectionPath) => {
                        let activeConnectionInterface = await NetworkManager._getInterface(connectionPath, 'org.freedesktop.NetworkManager.Connection.Active');
                        activeConnectionInterface.getProperties(async (err, properties) => {
                            if (err) {
                                console.error(err);
                            }
                            else {
                                console.log(`Properties for ${connectionPath}:`);
                                console.log(properties);
                                let connectionInterface = await NetworkManager._getInterface(properties.Connection, 'org.freedesktop.NetworkManager.Settings.Connection');
                                connectionInterface.GetSettings({}, (err, settings) => {
                                    console.log(`Settings for ${properties.Connection}:`);
                                    console.log(settings);
                                });
                            }
                        });
                    });
                }
            });
        });
    }
    static async _savedWpaConnections(settingsInterface) {
        return new Promise((resolve, reject) => {
            settingsInterface.ListConnections({}, async (err, savedConnectionPaths) => {
                let savedConnections = {};
                const forLoop = async () => {
                    for (let i = 0; i < savedConnectionPaths.length; i++) {
                        let connectionInterface = await NetworkManager._getInterface(savedConnectionPaths[i], 'org.freedesktop.NetworkManager.Settings.Connection');
                        connectionInterface.GetSettings({}, (err, settings) => {
                            if (settings['802-11-wireless']) {
                                savedConnections[savedConnectionPaths[i]] = NetworkManager._byteArrayToString(settings['802-11-wireless'].ssid);
                            }
                        });
                    }
                };
                await forLoop();
                resolve(savedConnections);
            });
        });
    }
    static async _discoveredAccessPoints(wifiDevice) {
        return new Promise(async (resolve, reject) => {
            wifiDevice.GetAllAccessPoints({}, async (err, accessPointPaths) => {
                if (err) {
                    reject(`Error Getting Access Points: ${err}`);
                }
                else {
                    let accessPointPropertiesMap = {};
                    const forLoop = async () => {
                        for (let i = 0; i < accessPointPaths.length; i++) {
                            let accessPoint = await NetworkManager._accessPointProperties(accessPointPaths[i]);
                            accessPointPropertiesMap[accessPointPaths[i]] = accessPoint;
                        }
                    };
                    await forLoop();
                    resolve(accessPointPropertiesMap);
                }
            });
        });
    }
    static async _accessPointProperties(accessPointPath) {
        return new Promise(async (resolve, reject) => {
            let accessPoint = await NetworkManager._getInterface(accessPointPath, 'org.freedesktop.NetworkManager.AccessPoint');
            accessPoint.getProperties((err, properties) => {
                if (err) {
                    reject(`Error getting access point properties: ${err}`);
                    return;
                }
                else {
                    properties.Ssid = NetworkManager._byteArrayToString(properties.Ssid);
                    let accessPoint = properties;
                    accessPoint.AccessPointPath = accessPointPath;
                    accessPoint.ConnectionSettingsCandidates = [];
                    resolve(accessPoint);
                }
            });
        });
    }
    static async _wifiDevice() {
        return new Promise(async (resolve, reject) => {
            let networkManager = await NetworkManager._getInterface('/org/freedesktop/NetworkManager', 'org.freedesktop.NetworkManager');
            networkManager.GetAllDevices({}, async (err, devicePaths) => {
                if (err) {
                    reject(`Get All Devices Err: ${err}`);
                    return;
                }
                const forLoop = async () => {
                    for (let i = 0; i < devicePaths.length; i++) {
                        let device = await NetworkManager._getInterface(devicePaths[i], 'org.freedesktop.NetworkManager.Device');
                        device.getProperties(async (err, properties) => {
                            if (err) {
                                reject(`Get device properties error: ${err}`);
                            }
                            else if (properties.DeviceType === dbus_types_1.DeviceType.WIFI) {
                                let wifiDevice = await NetworkManager._getInterface(devicePaths[i], 'org.freedesktop.NetworkManager.Device.Wireless');
                                resolve({
                                    interface: wifiDevice,
                                    path: devicePaths[i],
                                });
                                return;
                            }
                        });
                    }
                };
                await forLoop();
                reject(`No wifi device`);
            });
        });
    }
    static async _networkManagerProperties() {
        return new Promise(async (resolve, reject) => {
            let networkManager = await NetworkManager._getInterface('/org/freedesktop/NetworkManager', 'org.freedesktop.NetworkManager');
            networkManager.getProperties((err, properties) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(properties);
                }
            });
        });
    }
    static async _getInterface(object, iface) {
        return new Promise((resolve, reject) => {
            NetworkManager._bus.getInterface('org.freedesktop.NetworkManager', object, iface, (err, iface) => {
                if (err) {
                    reject(`Interface error: ${err}`);
                }
                else {
                    resolve(iface);
                }
            });
        });
    }
    static _byteArrayToString(array) {
        return String.fromCharCode.apply(String, array);
    }
    static _stringToByteArray(input) {
        let byteArray = [];
        for (let i = 0; i < input.length; i++) {
            byteArray[i] = input.charCodeAt(i);
        }
        return byteArray;
    }
}
exports.NetworkManager = NetworkManager;
NetworkManager._bus = dbus_1.default.getBus('system');
// Should update the active access point by watching the wifi device
// From org.freedesktop.NetworkManager.Device interface, we can get the device interface for wifi device.
// Should also get one for the ethernet device
// From there we can see the state of the connection
// If we get the org.freedesktop.NetworkManager.Device.Wireless interface, we can get the active access point we're connected to
// We can catch & update these during state change signals
// Yeah okay I need event hooks on the WifiDevice(Device) WifiDevice(Wireless) on state changes and printing out of properties
//
//# sourceMappingURL=index.js.map