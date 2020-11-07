import DBus from "dbus";

export interface WifiNetwork {
    ssid: string;
    frequency: number;
    strength: number;
    encrypted: boolean;
    supportsWPS: boolean;
}

export enum DeviceType {
    UNKNOWN         = 0, // unknown device
    GENERIC         = 14, // generic support for unrecognized device types
    ETHERNET        = 1, // a wired ethernet device
    WIFI            = 2, // an 802.11 Wi-Fi device
    UNUSED1         = 3, // not used
    UNUSED2         = 4, // not used
    BT              = 5, // a Bluetooth device supporting PAN or DUN access protocols
    OLPC_MESH       = 6, // an OLPC XO mesh networking device
    WIMAX           = 7, // an 802.16e Mobile WiMAX broadband device
    MODEM           = 8, // a modem supporting analog telephone, CDMA/EVDO, GSM/UMTS, or LTE network access protocols
    INFINIBAND      = 9, // an IP-over-InfiniBand device
    BOND            = 10, // a bond master interface
    VLAN            = 11, // an 802.1Q VLAN interface
    ADSL            = 12, // ADSL modem
    BRIDGE          = 13, // a bridge master interface
    TEAM            = 15, // a team master interface
    TUN             = 16, // a TUN or TAP interface
    IP_TUNNEL       = 17, // a IP tunnel interface
    MACVLAN         = 18, // a MACVLAN interface
    VXLAN           = 19, // a VXLAN interface
    VETH            = 20, // a VETH interface
    MACSEC          = 21, // a MACsec interface
    DUMMY           = 22, // a dummy interface
    PPP             = 23, // a PPP interface
    OVS_INTERFACE   = 24, // a Open vSwitch interface
    OVS_PORT        = 25, // a Open vSwitch port
    OVS_BRIDGE      = 26, // a Open vSwitch bridge
    WPAN            = 27, // a IEEE 802.15.4 (WPAN) MAC Layer Device
    LOWPAN          = 28, // 6LoWPAN interface
    WIREGUARD       = 29, // a WireGuard interface
    WIFI_P2P        = 30, // an 802.11 Wi-Fi P2P device
    VRF             = 31, // A VRF (Virtual Routing and Forwarding) interface
}

export enum WpaFlags {
    NONE    = 0x00000000, // access point has no special capabilities
    PRIVACY = 0x00000001, // access point requires authentication and encryption (usually means WEP)
    WPS     = 0x00000002, // access point supports some WPS method
    WPS_PBC = 0x00000004, // access point supports push-button WPS
    WPS_PIN = 0x00000008,  // access point supports PIN-based WPS
}

export enum SecurityFlags {
    NONE            = 0x00000000, // the access point has no special security requirements
    PAIR_WEP40      = 0x00000001, // 40/64-bit WEP is supported for pairwise/unicast encryption
    PAIR_WEP104     = 0x00000002, // 104/128-bit WEP is supported for pairwise/unicast encryption
    PAIR_TKIP       = 0x00000004, // TKIP is supported for pairwise/unicast encryption
    PAIR_CCMP       = 0x00000008, // AES/CCMP is supported for pairwise/unicast encryption
    GROUP_WEP40     = 0x00000010, // 40/64-bit WEP is supported for group/broadcast encryption
    GROUP_WEP104    = 0x00000020, // 104/128-bit WEP is supported for group/broadcast encryption
    GROUP_TKIP      = 0x00000040, // TKIP is supported for group/broadcast encryption
    GROUP_CCMP      = 0x00000080, // AES/CCMP is supported for group/broadcast encryption
    KEY_MGMT_PSK    = 0x00000100, // WPA/RSN Pre-Shared Key encryption is supported
    KEY_MGMT_802_1X = 0x00000200, // 802.1x authentication and key management is supported
    KEY_MGMT_SAE    = 0x00000400, // WPA/RSN Simultaneous Authentication of Equals is supported
    KEY_MGMT_OWE    = 0x00000800, // WPA/RSN Opportunistic Wireless Encryption is supported
    KEY_MGMT_OWE_TM = 0x00001000, // WPA/RSN Opportunistic Wireless Encryption transition mode is supported. Since: 1.26.
}

export enum WirelessMode {
    UNKNOWN = 0, // the device or access point mode is unknown
    ADHOC   = 1, // for both devices and access point objects, indicates the object is part of an Ad-Hoc 802.11 network without a central coordinating access point.
    INFRA   = 2, // the device or access point is in infrastructure mode. For devices, this indicates the device is an 802.11 client/station. For access point objects, this indicates the object is an access point that provides connectivity to clients.
    AP      = 3, // the device is an access point/hotspot. Not valid for access point objects; used only for hotspot mode on the local machine.
    MESH    = 4, // the device is a 802.11s mesh point. Since: 1.20.
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
            let wifiNetworks: WifiNetwork[] = [];

            const forLoop = async () => {
                for(let i = 0; i < accessPoints.length; i++) {
                    let accessPoint = await this.getInterface(accessPoints[i], 'org.freedesktop.NetworkManager.AccessPoint');
                    accessPoint.getProperties((err, properties) => {
                        if(err) {
                            reject(`Error getting access point properties: ${err}`);
                            return;
                        } else {
                            let ssidString: string = this.byteArrayToString(properties.Ssid);
                            let frequency: number = +(properties.Frequency / 1000).toFixed(1);
                            let strength: number = Math.ceil(+properties.Strength / 20) - 1;
                            let encrypted: boolean = (properties.Flags & WpaFlags.PRIVACY) > 0;
                            let supportsWPS: boolean = (properties.Flags & WpaFlags.WPS) > 0;

                            wifiNetworks.push({
                                ssid: ssidString,
                                frequency: frequency,
                                strength: strength,
                                encrypted: encrypted,
                                supportsWPS: supportsWPS
                            });
                        }
                    });
                }
            }

            await forLoop();

            resolve(wifiNetworks);
        });
    }

    public async getAccessPoints(): Promise<AccessPoint[]> {
        return new Promise<any>(async (resolve, reject) => {
            let devices = await this.getAllDevices();
            let wifiDevice: Device | null = null;

            const forLoop = async () => {
                for(let index = 0; index < devices.length; index++) {
                    let deviceProperties = await this.getAllProperiesForDevice(devices[index]);
    
                    if(deviceProperties.DeviceType === DeviceType.WIFI) {
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

    private byteArrayToString(array: number[]): string {
        return String.fromCharCode.apply(String, array);
    }

    // Not complete
    // private flagIntToEnumArray(enumeration: {
    //     [key: string]: any
    // }, flagsInt: number): any {
    //     let flags: any[] = [];

    //     Object.values(enumeration).map(Number).filter(Boolean).forEach(flag => {
    //         if(flag & flagsInt) {
    //             let enumString = enumeration[flag];
    //             flags.push();
    //         }
    //     });

    //     //return flags;
    // }

}