import DBus from "dbus";
import { BehaviorSubject, Observable } from "rxjs";
import { v4 as uuidv4 } from "uuid";
import { AccessPoint, AccessPointPath, ConnectionSettingsPath, ConnectionSettings, DevicePath, DeviceType, Ssid } from "./dbus-types";

type AccessPointMap = {
    [key: string]: AccessPoint
};

type SavedConnectionsMap = {
    [key: string]: Ssid;
};


export class NetworkManager {

    private static _bus: DBus.DBusConnection = DBus.getBus('system');

    private _settingsInterface: DBus.DBusInterface;
    private _wifiDeviceInterface: DBus.DBusInterface;

    private _savedWpaConnections: SavedConnectionsMap;

    private _accessPoints: AccessPointMap;
    private _accessPointsSubject: BehaviorSubject<AccessPoint[]>;
    public accessPoints$: Observable<AccessPoint[]>;
    public get accessPoints(): AccessPoint[] {
        return Object.values(this._accessPoints);
    }

    // public connectedAccessPoint: Observable<AccessPoint>;
    // public savedConnections: Observable<ConnectionSettings[]>;

    private constructor(settingsInterface: DBus.DBusInterface, wifiDeviceInterface: DBus.DBusInterface, savedWpaConnections: SavedConnectionsMap, existingAccessPoints: AccessPointMap) {
        this._settingsInterface = settingsInterface;
        this._wifiDeviceInterface = wifiDeviceInterface;

        this._savedWpaConnections = savedWpaConnections;

        this._accessPoints = existingAccessPoints;
        this._accessPointsSubject = new BehaviorSubject(Object.values(this._accessPoints));
        this.accessPoints$ = this._accessPointsSubject.asObservable();

        this._listenForConnectionSettings();
        this._listenForAccessPoints();
    }

    public static async init(): Promise<NetworkManager> {
        return new Promise<NetworkManager>(async (resolve, reject) => {
            let settingsInterface = await NetworkManager._getInterface('/org/freedesktop/NetworkManager/Settings', 'org.freedesktop.NetworkManager.Settings');
            let wifiDeviceInterface = await NetworkManager._wifiDeviceInterface();

            let savedWpaConnections = await NetworkManager._savedWpaConnections(settingsInterface);
            let discoveredAccessPoints = await NetworkManager._discoveredAccessPoints(wifiDeviceInterface);

            let knownSsids = Object.values(savedWpaConnections);
            for (const [_, accessPoint] of Object.entries(discoveredAccessPoints)) {
                if(knownSsids.includes(accessPoint.ssid)) {
                    accessPoint.connectionSettingsCandidates = Object.keys(savedWpaConnections).filter(settingsPath => savedWpaConnections[settingsPath] === accessPoint.ssid);
                }
            }

            let networkManager = new NetworkManager(settingsInterface, wifiDeviceInterface, savedWpaConnections, discoveredAccessPoints);
            resolve(networkManager);
        });
    }

    public async requestScan(): Promise<null> {
        return new Promise<null>(async (resolve, reject) => {
            this._wifiDeviceInterface.RequestScan({}, (err: any, result: any) => {
                if(err) {
                    reject(`Scan Error: ${err}`);
                    return;
                } else {
                    resolve();
                }
            });
        });
    }

    public addNewWpaConnection(ssid: string, password: string): Promise<ConnectionSettingsPath> {
        return new Promise<ConnectionSettingsPath>((resolve, reject) => {
            let ssidByteArray = NetworkManager._stringToByteArray(ssid);
            let connectionSettings = {
                "connection": {
                    "type": "802-11-wireless",
                    "uuid": uuidv4(),
                    "id": ssid
                },
                "802-11-wireless": {
                    "mode": "infrastructure",
                    "ssid": ssidByteArray,
                    "hidden": true
                },
                "802-11-wireless-security":  {
                    "key-mgmt": "wpa-psk",
                    "auth-alg": "open",
                    "psk": password
                },
                "ipv4": {
                    "method": "auto"
                },
                "ipv6": {
                    "method": "auto"
                }
            }

            this._settingsInterface.AddConnection(connectionSettings, (err: any, connectionSettingsPath: ConnectionSettingsPath) => {
                if(err) {
                    reject(err);
                } else {
                    resolve(connectionSettingsPath);
                }
            });
        });
    }

    public activateConnection(accessPointPath: AccessPointPath, connectionSettingsPath: ConnectionSettingsPath): Promise<void> {
        return new Promise<void>((resolve, reject) => {

        });
    }

    public setWifiEnabled(enabled: boolean): Promise<void> {
        return new Promise<void>((resolve, reject) => {

        });
    }

    public setEthernetEnabled(enabled: boolean): Promise<void> {
        return new Promise<void>((resolve, reject) => {

        });
    }

    private _listenForConnectionSettings() {
        this._settingsInterface.on('NewConnection', async (connectionSettingsPath: ConnectionSettingsPath) => {
            console.log(`Connection settings added: ${connectionSettingsPath}`);
            let connectionSettings = await NetworkManager._getInterface(connectionSettingsPath, 'org.freedesktop.NetworkManager.Settings.Connection');
            connectionSettings.GetSettings({}, (err: any, settings: any) => {
                if(!settings['802-11-wireless']) {
                    return;
                }

                let settingsSsid = NetworkManager._byteArrayToString(settings['802-11-wireless'].ssid);
                this._savedWpaConnections[connectionSettingsPath] = settingsSsid;

                for (const [_, accessPoint] of Object.entries(this._accessPoints)) {
                    if(accessPoint.ssid === settingsSsid) {
                        accessPoint.connectionSettingsCandidates.push(connectionSettingsPath);
                    }
                }

                this._accessPointsSubject.next(Object.values(this._accessPoints));
            })
        });

        this._settingsInterface.on('ConnectionRemoved', (connectionSettingsPath: ConnectionSettingsPath) => {
            console.log(`Connection settings removed: ${connectionSettingsPath}`);

            for (const [_, accessPoint] of Object.entries(this._accessPoints)) {
                if(accessPoint.connectionSettingsCandidates.includes(connectionSettingsPath)) {
                    let settingsPathIndex = accessPoint.connectionSettingsCandidates.indexOf(connectionSettingsPath);
                    accessPoint.connectionSettingsCandidates.splice(settingsPathIndex, 1);
                }
            }

            this._accessPointsSubject.next(Object.values(this._accessPoints));
        });
    }

    private _listenForAccessPoints() {
        this._wifiDeviceInterface.on('AccessPointAdded', async (accessPointPath: AccessPointPath) => {
            let accessPoint = await NetworkManager._accessPointProperties(accessPointPath);

            let knownSsids = Object.values(this._savedWpaConnections);
            if(knownSsids.includes(accessPoint.ssid)) {
                accessPoint.connectionSettingsCandidates = Object.keys(this._savedWpaConnections).filter(settingsPath => this._savedWpaConnections[settingsPath] === accessPoint.ssid);
            }

            this._accessPoints[accessPointPath] = accessPoint;
            this._accessPointsSubject.next(Object.values(this._accessPoints));
        });

        this._wifiDeviceInterface.on('AccessPointRemoved', (accessPointPath: AccessPointPath) => {
            if(this._accessPoints[accessPointPath]) {
                delete this._accessPoints[accessPointPath];
            }
            this._accessPointsSubject.next(Object.values(this._accessPoints));
        });
    }

    private static async _savedWpaConnections(settingsInterface: DBus.DBusInterface): Promise<SavedConnectionsMap>  {
        return new Promise<any>((resolve, reject) => {
            settingsInterface.ListConnections({}, async (err: any, savedConnectionPaths: any) => {
                let savedConnections: SavedConnectionsMap = {};

                const forLoop = async () => {
                    for(let i = 0; i < savedConnectionPaths.length; i++) {
                        let connectionInterface = await NetworkManager._getInterface(savedConnectionPaths[i], 'org.freedesktop.NetworkManager.Settings.Connection');
                        connectionInterface.GetSettings({}, (err: any, settings: any) => {
                            if(settings['802-11-wireless']) {
                                savedConnections[savedConnectionPaths[i]] = NetworkManager._byteArrayToString(settings['802-11-wireless'].ssid);
                            }
                        })
                    }
                }

                await forLoop();
                resolve(savedConnections);
            });
        });
    }

    private static async _discoveredAccessPoints(wifiDevice: DBus.DBusInterface): Promise<AccessPointMap> {
        return new Promise<AccessPointMap>(async (resolve, reject) => {
            wifiDevice.GetAllAccessPoints({}, async (err: any, accessPointPaths: any) => {
                if(err) {
                    reject(`Error Getting Access Points: ${err}`);
                } else {
                    let accessPointPropertiesMap: AccessPointMap = {};
                    const forLoop = async () => {
                        for(let i = 0; i < accessPointPaths.length; i++) {
                            let accessPoint = await NetworkManager._accessPointProperties(accessPointPaths[i]);
                            accessPointPropertiesMap[accessPointPaths[i]] = accessPoint;
                        }
                    }
                    await forLoop();

                    resolve(accessPointPropertiesMap);
                }
            });
        });
    }

    private static async _accessPointProperties(accessPointPath: string): Promise<AccessPoint> {
        return new Promise<AccessPoint>(async (resolve, reject) => {
            let accessPoint = await NetworkManager._getInterface(accessPointPath, 'org.freedesktop.NetworkManager.AccessPoint');
            accessPoint.getProperties((err, properties) => {
                if(err) {
                    reject(`Error getting access point properties: ${err}`);
                    return;
                } else {
                    properties.Ssid = NetworkManager._byteArrayToString(properties.Ssid);
                    let lowercaseProps: any = {};
                    for (const [key, value] of Object.entries(properties)) {
                        let camelcaseKey: string = key.charAt(0).toLowerCase() + key.slice(1);
                        lowercaseProps[camelcaseKey] = value;
                    }

                    let accessPoint = lowercaseProps as AccessPoint;
                    accessPoint.accessPointPath = accessPointPath;
                    accessPoint.connectionSettingsCandidates = [];

                    resolve(accessPoint);
                }
            });
        })
    }

    private static async _wifiDeviceInterface(): Promise<DBus.DBusInterface> {
        return new Promise<DBus.DBusInterface>(async (resolve, reject) => {
            let networkManager = await NetworkManager._getInterface('/org/freedesktop/NetworkManager', 'org.freedesktop.NetworkManager');
            networkManager.GetAllDevices({}, async (err: string, devicePaths: DevicePath[]) => {
                if(err) {
                    reject(`Get All Devices Err: ${err}`);
                    return;
                }

                const forLoop = async () => {
                    for(let i = 0; i < devicePaths.length; i++) {
                        let device = await NetworkManager._getInterface(devicePaths[i], 'org.freedesktop.NetworkManager.Device');
                        device.getProperties(async (err, properties) => {
                            if(err) {
                                reject(`Get device properties error: ${err}`);
                            } else if(properties.DeviceType === DeviceType.WIFI) {
                                let wifiDevice = await NetworkManager._getInterface(devicePaths[i], 'org.freedesktop.NetworkManager.Device.Wireless');
                                resolve(wifiDevice);
                                return;
                            }
                        })
                    }
                }

                await forLoop();
                reject(`No wifi device`);
            });
        });
    }

    private static async _getInterface(object: string, iface: string): Promise<DBus.DBusInterface> {
        return new Promise<DBus.DBusInterface>((resolve, reject) => {
            NetworkManager._bus.getInterface(
                'org.freedesktop.NetworkManager',
                object,
                iface,
                (err, iface) => {
                    if(err) {
                        reject(`Interface error: ${err}`);
                    } else {
                        resolve(iface);
                    }
                }
        )});
    }

    private static _byteArrayToString(array: number[]): string {
        return String.fromCharCode.apply(String, array);
    }

    private static _stringToByteArray(input: string): number[] {
        let byteArray: number[] = [];
        for(let i = 0; i < input.length; i++) {
            byteArray[i] = input.charCodeAt(i);
        }

        return byteArray;
    }

}