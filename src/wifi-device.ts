import DBus from '@astrohaus/dbus-next';
import { BehaviorSubject } from 'rxjs';
import { Observable } from 'rxjs/internal/Observable';
import { BaseDevice } from './base-device';
import { promises as fs } from 'fs';
import {
    AccessPointProperties,
    ConnectionProfilePath,
    RawAccessPointProperties,
    WifiDeviceProperties,
    WpaSupplicantProperties,
} from './dbus-types';
import { byteArrayToString, formatMacAddress, call, getAllProperties, getProperty, objectInterface, signal } from './util';

type AccessPointMap = {
    [key: string]: AccessPointProperties;
};

/* https://github.com/lcp/NetworkManager/blob/240f47c892b4e935a3e92fc09eb15163d1fa28d8/src/nm-wifi-ap.c#L357-L419 */
export class NM80211ApSecurityFlags {
    static readonly NM_802_11_AP_SEC_NONE = 0x00000000;
    static readonly NM_802_11_AP_SEC_PAIR_WEP40 = 0x00000001;
    static readonly NM_802_11_AP_SEC_PAIR_WEP104 = 0x00000002;
    static readonly NM_802_11_AP_SEC_PAIR_TKIP = 0x00000004;
    static readonly NM_802_11_AP_SEC_PAIR_CCMP = 0x00000008;
    static readonly NM_802_11_AP_SEC_GROUP_WEP40 = 0x00000010;
    static readonly NM_802_11_AP_SEC_GROUP_WEP104 = 0x00000020;
    static readonly NM_802_11_AP_SEC_GROUP_TKIP = 0x00000040;
    static readonly NM_802_11_AP_SEC_GROUP_CCMP = 0x00000080;
    static readonly NM_802_11_AP_SEC_KEY_MGMT_PSK = 0x00000100;
    static readonly NM_802_11_AP_SEC_KEY_MGMT_802_1X = 0x00000200;
    static readonly NM_802_11_AP_SEC_KEY_MGMT_SAE = 0x00000400;
    static readonly NM_802_11_AP_SEC_KEY_MGMT_OWE = 0x00000800;
    static readonly NM_802_11_AP_SEC_KEY_MGMT_OWE_TM = 0x00001000;
    static readonly NM_802_11_AP_SEC_KEY_MGMT_EAP_SUITE_B_192 = 0x00002000;

    private static pairToFlags(str: string): number {
        switch (str) {
            case 'wep40': return NM80211ApSecurityFlags.NM_802_11_AP_SEC_PAIR_WEP40;
            case 'wep104': return NM80211ApSecurityFlags.NM_802_11_AP_SEC_PAIR_WEP104;
            case 'tkip': return NM80211ApSecurityFlags.NM_802_11_AP_SEC_PAIR_TKIP;
            case 'ccmp': return NM80211ApSecurityFlags.NM_802_11_AP_SEC_PAIR_CCMP;
            default: return NM80211ApSecurityFlags.NM_802_11_AP_SEC_NONE;
        }
    }
    
    private static groupToFlags(str: string): number {
        switch (str) {
            case 'wep40': return NM80211ApSecurityFlags.NM_802_11_AP_SEC_GROUP_WEP40;
            case 'wep104': return NM80211ApSecurityFlags.NM_802_11_AP_SEC_GROUP_WEP104;
            case 'tkip': return NM80211ApSecurityFlags.NM_802_11_AP_SEC_GROUP_TKIP;
            case 'ccmp': return NM80211ApSecurityFlags.NM_802_11_AP_SEC_GROUP_CCMP;
            default: return NM80211ApSecurityFlags.NM_802_11_AP_SEC_NONE;
        }
    }
    
    private static keyMgmtToFlags(str: string): number {
        switch (str) {
            case 'wpa-psk': return NM80211ApSecurityFlags.NM_802_11_AP_SEC_KEY_MGMT_PSK;
            case 'wpa-eap': return NM80211ApSecurityFlags.NM_802_11_AP_SEC_KEY_MGMT_802_1X;
            case 'sae': return NM80211ApSecurityFlags.NM_802_11_AP_SEC_KEY_MGMT_SAE;
            case 'owe': return NM80211ApSecurityFlags.NM_802_11_AP_SEC_KEY_MGMT_OWE;
            case 'owe-tm': return NM80211ApSecurityFlags.NM_802_11_AP_SEC_KEY_MGMT_OWE_TM;
            case 'wpa-eap-suite-b-192': return NM80211ApSecurityFlags.NM_802_11_AP_SEC_KEY_MGMT_EAP_SUITE_B_192;
            default: return NM80211ApSecurityFlags.NM_802_11_AP_SEC_NONE;
        }
    }

    static securityFromDict(security: { [key: string]: any }): number {
        let flags = NM80211ApSecurityFlags.NM_802_11_AP_SEC_NONE;

        if (security.KeyMgmt) {
            const keyMgmtItems: string[] = security.KeyMgmt.value;
            keyMgmtItems.forEach(item => {
                flags |= NM80211ApSecurityFlags.keyMgmtToFlags(item);
            });
        }

        if (security.Pairwise) {
            const pairwiseItems: string[] = security.Pairwise.value;
            pairwiseItems.forEach(item => {
                flags |= NM80211ApSecurityFlags.pairToFlags(item);
            });
        }

        if (security.Group) {
            const groupItem: string = security.Group.value;
            flags |= NM80211ApSecurityFlags.groupToFlags(groupItem);
        }

        return flags;
    }
}

export class WifiDevice extends BaseDevice<WifiDeviceProperties> {
    private _wifiDeviceInterface: DBus.ClientInterface;
    private _wpaInterface: DBus.ClientInterface;

    private _accessPoints: AccessPointMap;
    private _accessPointsSubject: BehaviorSubject<AccessPointMap>;
    private _bssListeners: Map<string, any>;
    private _bssPathMap: Map<string, string>;
    private _accessPointPathMap: Map<string, string>;
    private _bssInterfaces: Map<string, DBus.ClientInterface>;

    /**
     * Continuously updated map of access points
     * Structured as a map where the key is the path of the access point
     * and the value is the access point data.
     * The Access Point path can be compared against the ActiveAccessPoint value of
     * WifiDevice properties to determine which Access Point is connected
     * */
    public accessPoints$: Observable<AccessPointMap>;
    /** Latest found access points as a one-time value */
    public get accessPoints(): AccessPointMap {
        return this._accessPoints;
    }

    private constructor(
        bus: DBus.MessageBus,
        devicePath: string,
        deviceInterface: DBus.ClientInterface,
        wifiDeviceInterface: DBus.ClientInterface,
        wpaInterface: DBus.ClientInterface,
        propertiesInterface: DBus.ClientInterface,
        initialProperties: any,
        initialAccessPoints: AccessPointMap,
        initialBssPathMap: Map<string, string>,
        initialAccessPointPathMap: Map<string, string>,
        initialBssInterfaces: Map<string, DBus.ClientInterface>
    ) {
        super(bus, devicePath, deviceInterface, propertiesInterface, initialProperties);

        this._wifiDeviceInterface = wifiDeviceInterface;

        this._accessPoints = initialAccessPoints;
        this._accessPointsSubject = new BehaviorSubject<AccessPointMap>(this._accessPoints);
        this.accessPoints$ = this._accessPointsSubject.asObservable();

        this._bssListeners = new Map();

        this._wpaInterface = wpaInterface;
        this._bssPathMap = initialBssPathMap;
        this._accessPointPathMap = initialAccessPointPathMap;
        this._bssInterfaces = initialBssInterfaces;

        this._listenForBss();
        this._listenForAccessPoints();
    }

    /**
     * Initializes a new WifiDevice
     * You should use networkManager.wifiDevice() unless you know what you're doing.
     *
     * @param bus An instance of a DBus connection
     * @param devicePath The path of the wifi device DBus object
     * @returns Promise of a WifiDevice
     */
    public static async init(bus: DBus.MessageBus, devicePath: string): Promise<WifiDevice> {
        try {
            const {
                concreteDeviceInterface: wifiDeviceInterface,
                concreteDeviceProperties: wifiDeviceProperties,
                deviceInterface,
                propertiesInterface,
                initialProperties,
            } = await BaseDevice._init(bus, devicePath, 'org.freedesktop.NetworkManager.Device.Wireless');

            const initialAccessPoints: AccessPointMap = {};
            const initialBssPathMap: Map<string, string> = new Map();
            const initialAccessPointPathMap: Map<string, string> = new Map();
            const initialBssInterfaces: Map<string, DBus.ClientInterface> = new Map();

            const getAccessPointDataFromPaths = async () => {
                const accessPoints = wifiDeviceProperties.AccessPoints.value;

                for (let i = 0; i < accessPoints.length; i++) {
                    let accessPointPath = accessPoints[i];
                    let accessPointInterface = await objectInterface(
                        bus,
                        accessPointPath,
                        'org.freedesktop.NetworkManager.AccessPoint',
                    );
                    let accessPointProperties = await getAllProperties(accessPointInterface);
                    accessPointProperties.Ssid.value = byteArrayToString(accessPointProperties.Ssid.value);
                    initialAccessPoints[accessPointPath] = accessPointProperties as AccessPointProperties;
                    let bssid = accessPointProperties.HwAddress.value;
                    initialAccessPointPathMap.set(bssid, accessPointPath);
                    initialAccessPointPathMap.set(accessPointPath, bssid);
                }
            };

            const getBSSs = async() => {
                const bss = await getProperty(wpaInterface, 'BSSs')
        
                for (let i = 0; i < bss.value.length; i++) {
                    let bssPath = bss.value[i];
                    let bssObject = await bus.getProxyObject('fi.w1.wpa_supplicant1', bssPath);
                    let bssInterface = await bssObject.getInterface('fi.w1.wpa_supplicant1.BSS');
                    let bssidArray = await getProperty(bssInterface, 'BSSID') as DBus.Variant<number[]>;
                    let bssid = formatMacAddress(bssidArray.value);
                    initialBssPathMap.set(bssid, bssPath);
                    initialBssPathMap.set(bssPath, bssid);
                    initialBssInterfaces.set(bssid, bssInterface);
                }
            };

            const interfaceNum = 0; // hardcode interface number to "0"
            const wpaPath = `/fi/w1/wpa_supplicant1/Interfaces/${interfaceNum}`
            const wpaObject = await bus.getProxyObject('fi.w1.wpa_supplicant1', wpaPath);
            const wpaInterface = await wpaObject.getInterface('fi.w1.wpa_supplicant1.Interface')
    
            await getBSSs();
            await getAccessPointDataFromPaths();

            return new WifiDevice(
                bus,
                devicePath,
                deviceInterface,
                wifiDeviceInterface,
                wpaInterface,
                propertiesInterface,
                initialProperties,
                initialAccessPoints,
                initialBssPathMap,
                initialAccessPointPathMap,
                initialBssInterfaces
            );
        } catch (error) {
            throw `Error creating wifi device: ${error}`;
        }
    }

    /**
     * Ask the wifi device to start scanning.
     * Scanning is complete when the WifiDevice's LastScan property is updated
     */
    public async requestScan(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {
                await call(this._wifiDeviceInterface, 'RequestScan', {});
                resolve();
            } catch (err) {
                reject(`Error requesting scan: ${err}`);
            }
        });
    }

    /**
     * Activates a connection based on a connection profile path
     * @param connectionProfilePath The path to the connection profile to activate
     */
    public async activateConnection(connectionProfilePath: ConnectionProfilePath): Promise<string> {
        return new Promise<string>(async (resolve, reject) => {
            try {
                let networkManagerInterface = await objectInterface(
                    this._bus,
                    '/org/freedesktop/NetworkManager',
                    'org.freedesktop.NetworkManager',
                );
                let activeConnectionPath = await call(
                    networkManagerInterface,
                    'ActivateConnection',
                    connectionProfilePath,
                    this.devicePath,
                    '/',
                );
                resolve(activeConnectionPath);
            } catch (err) {
                reject(err);
            }
        });
    }

    private _listenForAccessPoints() {
        this.listenSignal(this._wifiDeviceInterface, 'AccessPointAdded', async (params: any[]) => {
            try {
                const apPath: string = params[0];
                const accessPointInterface = await objectInterface(
                    this._bus,
                    apPath,
                    'org.freedesktop.NetworkManager.AccessPoint',
                );
                const rawAccessPointProperties = await getAllProperties<RawAccessPointProperties>(accessPointInterface);
                const accessPointProperties: AccessPointProperties = {
                    ...rawAccessPointProperties,
                    Ssid: {
                        ...rawAccessPointProperties.Ssid,
                        value: byteArrayToString(rawAccessPointProperties.Ssid.value),
                    },
                };

                const bssid = rawAccessPointProperties.HwAddress.value;
                this._accessPointPathMap.set(bssid, apPath);
                this._accessPointPathMap.set(apPath, bssid);

                this._accessPoints = { ...this._accessPoints, [apPath]: accessPointProperties };
                this._accessPointsSubject.next(this._accessPoints);
            } catch (error) {
                console.error(`ERROR: ${error}`);
                // If we can't find an access point's data, skip over it
            }
        });

        this.listenSignal(this._wifiDeviceInterface, 'AccessPointRemoved', async (params: any[]) => {
            const apPath = params[0];
            const { [apPath]: deletedAp, ...filteredAccessPoints } = this._accessPoints;

            const bssid = this._accessPointPathMap.get(apPath);
            this._accessPointPathMap.delete(apPath);
            if (bssid !== undefined) {
                this._accessPointPathMap.delete(bssid);
            }

            this._accessPoints = filteredAccessPoints;
            this._accessPointsSubject.next(this._accessPoints);
        });
    }

    private _listenForBss() {
        this.listenSignal<Partial<WpaSupplicantProperties>[]>(this._wpaInterface, 'BSSAdded', async (params: any[]) => {
            const bssPath = params[0];
            const bssid = formatMacAddress(params[1].BSSID.value);
            try {
                const bssObject = await this._bus.getProxyObject('fi.w1.wpa_supplicant1', bssPath);
                const bssInterface = await bssObject.getInterface('fi.w1.wpa_supplicant1.BSS');
                this._bssInterfaces.set(bssid, bssInterface);
                this._bssPathMap.set(bssid, bssPath);
                this._bssPathMap.set(bssPath, bssid);
    
                this._listenForBssPropertyChanges(bssid);
            } catch (error) {
                console.error(`BSSAdded signal handler ERROR: ${error}`);
                return;
            }
        });
        this.listenSignal(this._wpaInterface, 'BSSRemoved', async (params: any[]) => {
            const bssPath = params[0];
            const bssid = this._bssPathMap.get(bssPath);
            this._bssPathMap.delete(bssPath);
            if (bssid !== undefined) {
                this._bssPathMap.delete(bssid);
            }
            const listenerRef = this._bssListeners.get(bssPath);
            if (listenerRef) {
                listenerRef.unsubscribe();
                this._bssListeners.delete(bssPath);
            }
        });
        for (const bssid of this._bssInterfaces.keys()) {
            this._listenForBssPropertyChanges(bssid);
        }
    }

    private _listenForBssPropertyChanges(bssid: string) {
        const bssInterface = this._bssInterfaces.get(bssid);
        if (bssInterface === undefined) {
            return;
        }
        const listenerRef = this.listenSignal<Partial<WpaSupplicantProperties>[]>(
            bssInterface,
            'PropertiesChanged',
            async (params: any[]) => {
                const bssPath = this._bssPathMap.get(bssid);
                if (bssPath === undefined) {
                    console.error(`bssPath not found for ${bssid}`);
                    return;
                }
                const apPath = this._accessPointPathMap.get(bssid);
                if (apPath === undefined) {
                    console.error(`apPath not found for ${bssid}`);
                    return;
                }
                const props = this._accessPoints[apPath];
                if (params[0].Age !== undefined) {
                    props.LastSeen.value = (await this._getUptime()) + params[0].Age.value;
                }
                if (params[0].Frequency !== undefined) {
                    props.Frequency.value = params[0].Frequency.value;
                }
                if (params[0].WPA !== undefined) {
                    props.WpaFlags.value = NM80211ApSecurityFlags.securityFromDict(params[0].WPA.value);
                }
                if (params[0].RSN !== undefined) {
                    props.RsnFlags.value = NM80211ApSecurityFlags.securityFromDict(params[0].RSN.value);
                }
            }
        );
        this._bssListeners.set(bssid, listenerRef);
    }

    private async _getUptime(): Promise<number> {
        try {
            const data = await fs.readFile('/proc/uptime', 'utf8');
            const uptimeSeconds = parseInt(data.split(' ')[0]);
            return uptimeSeconds;
        } catch (error) {
            console.error('Error reading uptime:', error);
            throw error;
        }
    }
}
