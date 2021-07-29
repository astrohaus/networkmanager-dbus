import DBus, { Variant } from 'dbus-next';
import { BehaviorSubject, Observable } from 'rxjs';
import { DeepPartial } from 'utility-types';
import { call, getAllProperties, objectInterface, signal, stringToByteArray } from './util';
import { v4 as uuidv4 } from 'uuid';
import {
    ConnectionProfile,
    ConnectionProfilePath,
    ConnectionSettingsManagerProperties,
    Properties,
} from './dbus-types';

/**
 * Manages the saving and retrieving of connection profiles and the device's hostname
 * When connecting to a network (wired or wireless), you must provide a connection profile
 * by either creating one with `addConnectionProfile()` or using a saved connection profile.
 */
export class ConnectionSettingsManager {
    private _bus: DBus.MessageBus;
    private _connectionSettingsManagerInterface: DBus.ClientInterface;
    private _propertiesInterface: DBus.ClientInterface;

    private _properties: ConnectionSettingsManagerProperties;
    private _propertiesSubject: BehaviorSubject<ConnectionSettingsManagerProperties>;

    /** Continuously updated properties of the ConnectionSettingsManager */
    public properties$: Observable<ConnectionSettingsManagerProperties>;
    /** Get a one-time value of the latest ConnectionSettingsManager properties */
    public get properties(): ConnectionSettingsManagerProperties {
        return this._properties;
    }

    private _connectionProfiles: ConnectionProfile[];
    private _connectionProfilesSubject: BehaviorSubject<ConnectionProfile[]>;

    /** Continuously updated saved connection profiles */
    public connectionProfiles$: Observable<ConnectionProfile[]>;

    /** Get a one-time value of the latest saved connection profiles */
    public get connectionProfiles(): ConnectionProfile[] {
        return this._connectionProfiles;
    }

    private constructor(
        bus: DBus.MessageBus,
        connectionSettingsManagerInterface: DBus.ClientInterface,
        propertiesInterface: DBus.ClientInterface,
        initialProperties: any,
        initialConnectionProfiles: any,
    ) {
        this._bus = bus;
        this._connectionSettingsManagerInterface = connectionSettingsManagerInterface;

        this._propertiesInterface = propertiesInterface;
        this._properties = initialProperties;
        this._propertiesSubject = new BehaviorSubject<any>(this._properties);
        this.properties$ = this._propertiesSubject.asObservable();

        this._connectionProfiles = initialConnectionProfiles;
        this._connectionProfilesSubject = new BehaviorSubject<any>(this._connectionProfiles);
        this.connectionProfiles$ = this._connectionProfilesSubject.asObservable();

        this._listenForPropertyChanges();
        this._listenForConnections();
    }

    /**
     * Initializes a new ConnectionSettingsManager given a DBus connection
     * @constructor
     * @param bus The system DBus instance to use for communicating with NetworkManager
     */
    public static async init(bus: DBus.MessageBus): Promise<ConnectionSettingsManager> {
        return new Promise<ConnectionSettingsManager>(async (resolve, reject) => {
            try {
                let connectionSettingsManagerInterface = await objectInterface(
                    bus,
                    '/org/freedesktop/NetworkManager/Settings',
                    'org.freedesktop.NetworkManager.Settings',
                );

                let propertiesInterface = await objectInterface(
                    bus,
                    '/org/freedesktop/NetworkManager/Settings',
                    'org.freedesktop.DBus.Properties',
                );
                let initialProperties = await getAllProperties(connectionSettingsManagerInterface);

                let initialConnectionProfiles: any = {};
                let connectionPaths: string[] = await call(connectionSettingsManagerInterface, 'ListConnections');

                const getConnectionSettingsForConnectionPaths = async () => {
                    for (let i = 0; i < connectionPaths.length; i++) {
                        let connectionProfileInterface = await objectInterface(
                            bus,
                            connectionPaths[i],
                            'org.freedesktop.NetworkManager.Settings.Connection',
                        );
                        initialConnectionProfiles[connectionPaths[i]] = await call(
                            connectionProfileInterface,
                            'GetSettings',
                        );
                    }
                };

                await getConnectionSettingsForConnectionPaths();

                let connectionSettingsManager = new ConnectionSettingsManager(
                    bus,
                    connectionSettingsManagerInterface,
                    propertiesInterface,
                    initialProperties,
                    initialConnectionProfiles,
                );

                resolve(connectionSettingsManager);
            } catch (err) {
                reject(`Error initializing network manager: ${err}`);
            }
        });
    }

    /**
     * Adds a new connection profile and returns the path of the new profile
     * @param connectionSettings Connection settings to use when constructing the profile
     * @returns Promise of the new connection profile path
     * @see https://developer.gnome.org/NetworkManager/stable/settings-connection.html
     * @see https://developer.gnome.org/NetworkManager/stable/nm-settings-nmcli.html
     */
    public addConnectionProfile(connectionSettings: DeepPartial<ConnectionProfile>): Promise<ConnectionProfilePath> {
        return call(this._connectionSettingsManagerInterface, 'AddConnection', connectionSettings);
    }

    /**
     * Convenience function to add new WPA wifi connection profiles
     * @param ssid SSID of the network to connect to as a string
     * @param hidden Whether or not the network has a hidden SSID
     * @param password The password of the network
     * @returns Promise of the new connection profile's path
     */
    public addWifiWpaConnection(ssid: string, hidden: boolean, password?: string): Promise<ConnectionProfilePath> {
        let connectionProfile: DeepPartial<ConnectionProfile> = {
            connection: {
                type: new Variant('s', '802-11-wireless'),
                'interface-name': new Variant('s', 'wlan0'),
                uuid: new Variant('s', uuidv4()),
                id: new Variant('s', ssid),
            },
            '802-11-wireless': {
                ssid: new Variant('ay', stringToByteArray(ssid)),
                mode: new Variant('s', 'infrastructure'),
            },
            ipv4: {
                method: new Variant('s', 'auto'),
            },
            ipv6: {
                method: new Variant('s', 'ignore'),
            },
        };

        if (password) {
            connectionProfile['802-11-wireless-security'] = {
                'key-mgmt': new Variant('s', 'wpa-psk'),
                'auth-alg': new Variant('s', 'open'),
                psk: new Variant('s', password),
            };
            connectionProfile['802-11-wireless']!.security = new Variant('s', '802-11-wireless-security');
        }

        if (hidden) {
            connectionProfile['802-11-wireless']!.hidden = new Variant('b', true);
        }

        return this.addConnectionProfile(connectionProfile);
    }

    /**
     * Deactivates and deletes a connection profile
     * This is used to implement "forget wifi network" functionality
     * @param profilePath The connection profile path to remove
     */
    public removeConnectionProfile(profilePath: ConnectionProfilePath): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {
                let connectionProfileInterface = await objectInterface(
                    this._bus,
                    profilePath,
                    'org.freedesktop.NetworkManager.Settings.Connection',
                );
                await call(connectionProfileInterface, 'Delete');
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    }

    private _listenForPropertyChanges() {
        signal(this._propertiesInterface, 'PropertiesChanged').subscribe((propertyChangeInfo: Array<Properties>) => {
            let changedProperties = propertyChangeInfo[1];
            Object.assign(this._properties, changedProperties);
            this._propertiesSubject.next(this._properties);
        });
    }

    private _listenForConnections() {
        signal(this._connectionSettingsManagerInterface, 'NewConnection').subscribe(async (signal: any[]) => {
            let newConnectionPath = signal[0];
            let connectionProfileInterface = await objectInterface(
                this._bus,
                newConnectionPath,
                'org.freedesktop.NetworkManager.Settings.Connection',
            );
            this._connectionProfiles[newConnectionPath] = await call(connectionProfileInterface, 'GetSettings');
            this._connectionProfilesSubject.next(this._connectionProfiles);
        });

        signal(this._connectionSettingsManagerInterface, 'ConnectionRemoved').subscribe(async (signal: any[]) => {
            let removedConnectionPath = signal[0];
            delete this._connectionProfiles[removedConnectionPath];
            this._connectionProfilesSubject.next(this._connectionProfiles);
        });
    }
}
