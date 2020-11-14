import DBus = require("dbus");
import { Observable } from "rxjs";

export async function objectInterface(bus: DBus.DBusConnection, objectPath: string, interfaceName: string): Promise<DBus.DBusInterface> {
    return new Promise<DBus.DBusInterface>((resolve, reject) => {
        bus.getInterface(
            'org.freedesktop.NetworkManager',
            objectPath,
            interfaceName,
            (err: any, iface: DBus.DBusInterface) => {
                if(err) {
                    reject(`Error getting ${interfaceName} interface on ${objectPath}: ${err}`);
                } else {
                    resolve(iface);
                }
            }
    )});
}

export function signal(objectInterface: DBus.DBusInterface, signalName: string): Observable<any> {
    return new Observable<any>(observer => {
        const listener = (...args: any[]) => {
            observer.next(args);
        }

        objectInterface.on(signalName, listener);
        return({
            unsubscribe() {
                objectInterface.off(signalName, listener);
            }
        });
    })
}

export async function call(objectInterface: DBus.DBusInterface, methodName: string, options: any, ...args: any[]): Promise<any> {
    return new Promise<any>(((resolve, reject) => {
        if(args.length) {
            objectInterface[methodName](args, options, (err: string, result: any) => {
                if(err) {
                    reject(`Error calling ${methodName} on ${objectInterface.interfaceName}: ${err}`);
                } else {
                    resolve(result);
                }
            });
        } else {
            objectInterface[methodName](options, (err: string, result: any) => {
                if(err) {
                    reject(`Error calling ${methodName} on ${objectInterface.interfaceName}: ${err}`);
                } else {
                    resolve(result);
                }
            });
        }
    }));
}

export async function getProperty(objectInterface: DBus.DBusInterface, propertyName: string): Promise<any> {
    return new Promise<any>((resolve, reject) => {
        objectInterface.getProperty(propertyName, (err, result) => {
            if(err) {
                reject(`Error getting property ${propertyName} on ${objectInterface.interfaceName} interface for object ${objectInterface.objectPath}: ${err}`);
            } else {
                resolve(result);
            }
        })
    });
}

export async function getAllProperties(objectInterface: DBus.DBusInterface): Promise<any> {
    return new Promise<any>((resolve, reject) => {
        objectInterface.getProperties((err, result) => {
            if(err) {
                reject(`Error getting all properties for object ${objectInterface.objectPath} with interface ${objectInterface.interfaceName}: ${err}`);
            } else {
                resolve(result);
            }
        })
    });
}

export function byteArrayToString(array: number[]): string {
    return String.fromCharCode.apply(String, array);
}

export function stringToByteArray(input: string): number[] {
    let byteArray: number[] = [];
    for(let i = 0; i < input.length; i++) {
        byteArray[i] = input.charCodeAt(i);
    }

    return byteArray;
}