import DBus from "dbus";
import { BehaviorSubject, Observable } from "rxjs";
import { call, getAllProperties, objectInterface, signal, stringToByteArray } from "./util";
import { v4 as uuidv4 } from 'uuid';

export class ConnectionSettingsManager {

    private _bus: DBus.DBusConnection;
    private _connectionSettingsManagerInterface: DBus.DBusInterface;

    private _propertiesInterface: DBus.DBusInterface;
    private _properties: any;
    private _propertiesSubject: BehaviorSubject<any>;
    public properties$: Observable<any>;
    public get properties(): any {
        return this._properties;
    }

    private _connectionProfiles: any;
    private _connectionProfilesSubject: BehaviorSubject<any>;
    public connectionProfiles$: Observable<any>;
    public get connectionProfiles(): any {
        return this._connectionProfiles;
    }

    private constructor(
        bus: DBus.DBusConnection,
        connectionSettingsManagerInterface: DBus.DBusInterface,
        propertiesInterface: DBus.DBusInterface,
        initialProperties: any,
        initialConnectionProfiles: any
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

    public static async init(bus: DBus.DBusConnection): Promise<ConnectionSettingsManager> {
        return new Promise<ConnectionSettingsManager>(async (resolve, reject) => {
            try {
                let connectionSettingsManagerInterface = await objectInterface(bus, '/org/freedesktop/NetworkManager/Settings', 'org.freedesktop.NetworkManager.Settings');

                let propertiesInterface = await objectInterface(bus, '/org/freedesktop/NetworkManager/Settings', 'org.freedesktop.DBus.Properties');
                let initialProperties = await getAllProperties(connectionSettingsManagerInterface);

                let initialConnectionProfiles: any = {};
                let connectionPaths: string[] = await call(connectionSettingsManagerInterface, 'ListConnections', {});

                const getConnectionSettingsForConnectionPaths = async () => {
                    for(let i = 0; i < connectionPaths.length; i++) {
                        let connectionProfileInterface = await objectInterface(bus, connectionPaths[i], 'org.freedesktop.NetworkManager.Settings.Connection');
                        initialConnectionProfiles[connectionPaths[i]] = await call(connectionProfileInterface, 'GetSettings', {});
                    }
                }

                await getConnectionSettingsForConnectionPaths();

                let connectionSettingsManager = new ConnectionSettingsManager(
                    bus, 
                    connectionSettingsManagerInterface,
                    propertiesInterface,
                    initialProperties,
                    initialConnectionProfiles
                );

                resolve(connectionSettingsManager);
            } catch(err) {
                reject(`Error initializing network manager: ${err}`);
            }
        });
    }

    public addConnectionProfile(connectionSettings: any): Promise<string> {
        return new Promise<string>(async (resolve, reject) => {
            try {
                let connectionProfilePath = await call(this._connectionSettingsManagerInterface, "AddConnection", {}, connectionSettings);
                resolve(connectionProfilePath);
            } catch(err) {
                reject(err);
            }
        });
    }

    public addWifiConnection(ssid: string, hidden: boolean, password?: string): Promise<string> {
        let connectionProfile: any = {
            connection: {
              type: "802-11-wireless",
              "interface-name": "wlan0",
              uuid: uuidv4(),
              id: ssid
            },
            "802-11-wireless": {
                ssid: stringToByteArray(ssid),
                mode: 'infrastructure'
            },
            "ipv4": {
                method: "auto"
            },
            "ipv6": {
                method: "ignore"
            }
        };

        if(password) {
            connectionProfile["802-11-wireless-security"] = {
                "key-mgmt": "wpa-psk",
                "auth-alg": "open",
                "psk": password
            };
            connectionProfile["802-11-wireless"].security = "802-11-wireless-security";
        }

        if(hidden) {
            connectionProfile["802-11-wireless"].hidden = true;
        }

        console.log("WIFI CONNECTION PROPS");
        console.log(connectionProfile);

        return this.addConnectionProfile(connectionProfile);
    }

    public removeConnectionProfile(profilePath: string): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {
                let connectionProfileInterface = await objectInterface(this._bus, profilePath, "org.freedesktop.NetworkManager.Settings.Connection");
                await call(connectionProfileInterface, "Delete", {});
                resolve();
            } catch(err) {
                reject(err);
            }
        });
    }

    public updateConnectionProfile(profilePath: string, connectionSettings: any): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {
                let connectionProfileInterface = await objectInterface(this._bus, profilePath, "org.freedesktop.NetworkManager.Settings.Connection");
                await call(connectionProfileInterface, "Delete", {}, connectionSettings);
                resolve();
            } catch(err) {
                reject(err);
            }
        });
    }

    private _listenForPropertyChanges() {
        signal(this._propertiesInterface, "PropertiesChanged").subscribe((propertyChangeInfo: any[]) => {
            let changedProperties = propertyChangeInfo[1];
            Object.assign(this._properties, changedProperties);
            this._propertiesSubject.next(this._properties);
        })
    }

    private _listenForConnections() {
        signal(this._connectionSettingsManagerInterface, "NewConnection").subscribe(async (signal: any[]) => {
            let newConnectionPath = signal[0];
            let connectionProfileInterface = await objectInterface(this._bus, newConnectionPath, 'org.freedesktop.NetworkManager.Settings.Connection');
            this._connectionProfiles[newConnectionPath] = await call(connectionProfileInterface, 'GetSettings', {});
            this._connectionProfilesSubject.next(this._connectionProfiles);
        });

        signal(this._connectionSettingsManagerInterface, "ConnectionRemoved").subscribe(async (signal: any[]) => {
            let removedConnectionPath = signal[0];
            delete this._connectionProfiles[removedConnectionPath];
            this._connectionProfilesSubject.next(this._connectionProfiles);
        });
    }
}