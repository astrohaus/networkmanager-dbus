import DBus from "dbus";

export enum Frequency {
    TWO,
    FIVE
}

export interface WifiNetwork {
    ssid: string;
    frequency: Frequency
}

export enum DeviceType {
    UNKNOWN=0,
    GENERIC=14,
    ETHERNET=1,
    WIFI=2,
    BT=5,
    OLPC_MESH=6,
    WIMAX=7,
    MODEM=8,
    INFINIBAND=9,
    BOND=10,
    VLAN=11,
    ADSL=12,
    BRIDGE=13,
    TEAM=15,
    TUN=16,
    IP_TUNNEL=17,
    MACVLAN=18,
    VXLAN=19,
    VETH=20
}

export type Connection = string;
export type Device = string;
export type AccessPoint = string;

export class NetworkManager {

    bus: DBus.DBusConnection;
    //wifiDevice: Device;
    //ethernetDevice: Device;

    constructor() {
        this.bus = DBus.getBus('system');
    }

    public getDiscoveredWifiNetworks(): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
            let accessPoints = await this.getAccessPoints();
            accessPoints.forEach(async accessPointPath => {
                let accessPoint = await this.getInterface(accessPointPath, 'org.freedesktop.NetworkManager.AccessPoint');
                accessPoint.getProperties((err, properties) => {
                    if(err) {
                        reject(`Error getting access point properties: ${err}`);
                    } else {
                        console.log(properties);
                        let ssidString = this.byteArrayToString(properties.Ssid);
                        console.log(ssidString);
                        resolve();
                    }
                });
            });
        });
    }

    public async getAccessPoints(): Promise<AccessPoint[]> {
        return new Promise<any>(async (resolve, reject) => {
            let devices = await this.getAllDevices();
            let wifiDevice: Device | null = null;

            const forLoop = async () => {
                for(let index = 0; index < devices.length; index++) {
                    let deviceProperties = await this.getAllProperiesForDevice(devices[index]);
    
                    if(deviceProperties.DeviceType == DeviceType.WIFI) {
                        wifiDevice = devices[index];
                    }
                }
            }

            await forLoop();

            if(wifiDevice) {
                let wifiInterface = await this.getInterface(wifiDevice, 'org.freedesktop.NetworkManager.Device.Wireless');
                wifiInterface.GetAllAccessPoints({}, (err: any, result: any) => {
                    if(err) {
                        reject(`Error Getting Access Points: ${err}`);
                    } else {
                        resolve(result as unknown as AccessPoint[]);
                    }
                });
            } else {
                reject(`No Wifi device found`);
            }
        });
    }

    private async getInterface(object: string, iface: string): Promise<DBus.DBusInterface> {
        return new Promise<DBus.DBusInterface>((resolve, reject) => {
            this.bus.getInterface(
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

    public async getActiveConnections(): Promise<Connection[]> {
        return new Promise<string[]>(async (resolve, reject) => {
            let networkManager = await this.getInterface('/org/freedesktop/NetworkManager', 'org.freedesktop.NetworkManager');
            networkManager.getProperty('ActiveConnections', (err, result) => {
                if(err) {
                    reject(`Get Active Connections Err: ${err}`);
                } else {
                    resolve(result as unknown as Connection[]);
                }
            });
        });
    }

    public async getDevicesForConnection(connectionPath: Connection): Promise<Device[]> {
        return new Promise<Device[]>(async (resolve, reject) => {
            let activeConnection = await this.getInterface(connectionPath, 'org.freedesktop.NetworkManager.Connection.Active');
            activeConnection.getProperty("Devices", (err, result) => {
                if(err) {
                    reject(`Get device err: ${err}`);
                } else {
                    resolve(result as unknown as Device[]);
                }
            });
        });
    }

    public async getAllProperiesForDevice(devicePath: Device): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
            let device = await this.getInterface(devicePath, 'org.freedesktop.NetworkManager.Device');
            device.getProperties(async (err, properties) => {
                if(err) {
                    reject(`Get all properties err: ${err}`);
                } else {
                    resolve(properties);
                }
            })
        })
    }

    public async getAllDevices(): Promise<Device[]> {
        return new Promise<Device[]>(async (resolve, reject) => {
            let networkManager = await this.getInterface('/org/freedesktop/NetworkManager', 'org.freedesktop.NetworkManager');
            networkManager.GetAllDevices({}, function(err: string, devices: Device[]) {
                if(err) {
                    reject(`Get All Devices Err: ${err}`);
                } else {
                    resolve(devices);
                }
            });
        });
    }

    private byteArrayToString(array: number[]): String {
        return String.fromCharCode.apply(String, array);
    }

}