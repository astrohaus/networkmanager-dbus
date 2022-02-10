import DBus from '@astrohaus/dbus-next';
import { Observable } from 'rxjs';
import { Properties } from './dbus-types';

export async function objectInterface(
    bus: DBus.MessageBus,
    objectPath: string,
    interfaceName: string,
): Promise<DBus.ClientInterface> {
    const proxyObject = await bus.getProxyObject('org.freedesktop.NetworkManager', objectPath);

    try {
        return proxyObject.getInterface(interfaceName);
    } catch (error) {
        throw new Error(`Error getting ${interfaceName} interface on ${objectPath}: ${error}`);
    }
}

export function signal<T extends Array<any> = any[]>(
    objectInterface: DBus.ClientInterface,
    signalName: string,
): Observable<T> {
    return new Observable<T>((observer) => {
        const listener = (...args: T) => {
            observer.next(args);
        };

        objectInterface.on(signalName, listener);
        return {
            unsubscribe() {
                objectInterface.off(signalName, listener);
            },
        };
    });
}

export async function call<T = any>(
    objectInterface: DBus.ClientInterface,
    methodName: string,
    ...args: any[]
): Promise<T> {
    try {
        const result = await objectInterface[methodName](...args);
        return result;
    } catch (error) {
        throw new Error(`Error calling ${methodName} on ${objectInterface.$name}: ${error}`);
    }
}

export function getPropertiesInterface(object: DBus.ProxyObject) {
    try {
        return object.getInterface('org.freedesktop.DBus.Properties');
    } catch (error) {
        throw new Error(`Error getting interface for properties: ${error}`);
    }
}

export async function getProperty(objectInterface: DBus.ClientInterface, propertyName: string): Promise<any> {
    const object = objectInterface.$object as unknown as DBus.ProxyObject;
    const propertiesInterface = getPropertiesInterface(object);

    try {
        return await propertiesInterface.Get(objectInterface.$name, propertyName);
    } catch (error) {
        throw new Error(
            `Error getting property ${propertyName} on ${objectInterface.$name} interface for object ${object.path}: ${error}`,
        );
    }
}

export async function setProperty(
    objectInterface: DBus.ClientInterface,
    propertyName: string,
    value: any,
): Promise<any> {
    const object = objectInterface.$object as unknown as DBus.ProxyObject;
    const propertiesInterface = getPropertiesInterface(object);

    try {
        return await propertiesInterface.Set(objectInterface.$name, propertyName, value);
    } catch (error) {
        throw new Error(
            `Error setting property ${propertyName} on ${objectInterface.$name} interface for object ${object.path}: ${error}`,
        );
    }
}

export async function getAllProperties<TPropetries extends Properties = Properties>(
    objectInterface: DBus.ClientInterface,
): Promise<TPropetries> {
    const object = objectInterface.$object as unknown as DBus.ProxyObject;
    const propertiesInterface = getPropertiesInterface(object);

    try {
        return await propertiesInterface.GetAll(objectInterface.$name);
    } catch (error) {
        throw new Error(
            `Error getting all properties for object ${objectInterface.objectPath} with interface ${objectInterface.interfaceName}: ${error}`,
        );
    }
}

export function byteArrayToString(array: number[]): string {
    return String.fromCharCode.apply(String, array);
}

export function stringToByteArray(input: string): number[] {
    let byteArray: number[] = [];
    for (let i = 0; i < input.length; i++) {
        byteArray[i] = input.charCodeAt(i);
    }

    return byteArray;
}

export function int32ToByteArray(int: number): Uint8Array {
    let byteArray = new ArrayBuffer(4); // an Int32 takes 4 bytes
    new DataView(byteArray).setUint32(0, int, false); // byteOffset = 0; litteEndian = false

    return new Uint8Array(byteArray);
}

export function formatIp4Address(ipAddress: number) {
    if (ipAddress === 0) {
        return null;
    }

    const byteArray = int32ToByteArray(ipAddress);

    return byteArray.reverse().join('.');
}
