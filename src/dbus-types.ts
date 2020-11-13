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

export interface AccessPoint {
    flags: number,
    wpaFlags: number,
    rsnFlags: number,
    ssid: string,
    frequency: number,
    hwAddress: string,
    mode: number,
    maxBitrate: number,
    strength: number,
    lastSeen: number,
    accessPointPath: AccessPointPath,
    connectionSettingsCandidates: ConnectionSettingsPath[]
}

export type ConnectionSettings = any;
export type ConnectionSettingsPath = string;
export type DevicePath = string;
export type AccessPointPath = string;
export type SettingsPath = string;
export type Ssid = string;