import DBus from 'dbus-next';
import { PartialObserver, Subscription } from 'rxjs';
import { signal } from './util';

export class Signaler {
    private _subscriptions: Subscription[];

    constructor() {
        this._subscriptions = [];
    }

    public listenSignal<T extends Array<any> = any[]>(
        objectInterface: DBus.ClientInterface,
        signalName: string,
        next?: (value: T) => void,
        error?: (error: any) => void,
        complete?: () => void,
    ): Subscription;
    public listenSignal<T extends Array<any> = any[]>(
        objectInterface: DBus.ClientInterface,
        signalName: string,
        observer: PartialObserver<T>,
    ): Subscription;
    public listenSignal<T extends Array<any> = any[]>(
        objectInterface: DBus.ClientInterface,
        signalName: string,
        ...args: any[]
    ) {
        const subscription = signal<T>(objectInterface, signalName).subscribe(...args);
        this._subscriptions.push(subscription);

        return subscription;
    }

    /**
     * Unsubscribes from all subscriptions.
     */
    public async unsubscribeAll() {
        for (const subscription of this._subscriptions) {
            subscription.unsubscribe();
        }
    }
}
