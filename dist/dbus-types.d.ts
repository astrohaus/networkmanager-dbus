export declare enum DeviceType {
    UNKNOWN = 0,
    GENERIC = 14,
    ETHERNET = 1,
    WIFI = 2,
    UNUSED1 = 3,
    UNUSED2 = 4,
    BT = 5,
    OLPC_MESH = 6,
    WIMAX = 7,
    MODEM = 8,
    INFINIBAND = 9,
    BOND = 10,
    VLAN = 11,
    ADSL = 12,
    BRIDGE = 13,
    TEAM = 15,
    TUN = 16,
    IP_TUNNEL = 17,
    MACVLAN = 18,
    VXLAN = 19,
    VETH = 20,
    MACSEC = 21,
    DUMMY = 22,
    PPP = 23,
    OVS_INTERFACE = 24,
    OVS_PORT = 25,
    OVS_BRIDGE = 26,
    WPAN = 27,
    LOWPAN = 28,
    WIREGUARD = 29,
    WIFI_P2P = 30,
    VRF = 31
}
export declare enum WpaFlags {
    NONE = 0,
    PRIVACY = 1,
    WPS = 2,
    WPS_PBC = 4,
    WPS_PIN = 8
}
export declare enum SecurityFlags {
    NONE = 0,
    PAIR_WEP40 = 1,
    PAIR_WEP104 = 2,
    PAIR_TKIP = 4,
    PAIR_CCMP = 8,
    GROUP_WEP40 = 16,
    GROUP_WEP104 = 32,
    GROUP_TKIP = 64,
    GROUP_CCMP = 128,
    KEY_MGMT_PSK = 256,
    KEY_MGMT_802_1X = 512,
    KEY_MGMT_SAE = 1024,
    KEY_MGMT_OWE = 2048,
    KEY_MGMT_OWE_TM = 4096
}
export declare enum WirelessMode {
    UNKNOWN = 0,
    ADHOC = 1,
    INFRA = 2,
    AP = 3,
    MESH = 4
}
export declare enum NetworkManagerState {
    UNKNOWN = 0,
    ASLEEP = 10,
    DISCONNECTED = 20,
    DISCONNECTING = 30,
    CONNECTING = 40,
    CONNECTED_LOCAL = 50,
    CONNECTED_SITE = 60,
    CONNECTED_GLOBAL = 70
}
export declare enum Metered {
    UNKNOWN = 0,
    YES = 1,
    NO = 2,
    GUESS_YES = 3,
    GUESS_NO = 4
}
export declare enum ConnectivityState {
    UNKNOWN = 0,
    NONE = 1,
    PORTAL = 2,
    LIMITED = 3,
    FULL = 4
}
export interface AccessPoint {
    Flags: number;
    WpaFlags: number;
    RsnFlags: number;
    Ssid: string;
    Frequency: number;
    HwAddress: string;
    Mode: number;
    MaxBitrate: number;
    Strength: number;
    LastSeen: number;
    AccessPointPath: AccessPointPath;
    ConnectionSettingsCandidates: ConnectionSettingsPath[];
}
export interface NetworkManagerProperties {
    Devices: DevicePath[];
    AllDevices: DevicePath[];
    Checkpoints: any[];
    NetworkingEnabled: boolean;
    WirelessEnabled: boolean;
    WirelessHardwareEnabled: boolean;
    WwanEnabled: boolean;
    WwanHardwareEnabled: boolean;
    WimaxEnabled: boolean;
    WimaxHardwareEnabled: boolean;
    ActiveConnections: ActiveConnectionPath[];
    PrimaryConnection: ActiveConnectionPath;
    PrimaryConnectionType: string;
    Metered: Metered;
    ActivatingConnection: ActiveConnectionPath;
    Startup: boolean;
    Version: string;
    Capabilities: any[];
    State: NetworkManagerState;
    Connectivity: ConnectivityState;
    ConnectivityCheckAvailable: boolean;
    ConnectivityCheckEnabled: boolean;
    ConnectivityCheckUri: string;
    GlobalDnsConfiguration: any[];
}
export declare type ConnectionSettings = any;
export declare type ConnectionSettingsPath = string;
export declare type DevicePath = string;
export declare type AccessPointPath = string;
export declare type SettingsPath = string;
export declare type ActiveConnectionPath = string;
export declare type Ssid = string;
