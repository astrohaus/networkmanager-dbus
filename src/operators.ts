/**
 * Custom RXJS operators.
 */

import { distinctUntilKeyChanged } from 'rxjs/operators';
import { Properties } from './dbus-types';

export function distinctUntilVariantChanged<T extends Properties, K extends keyof T>(
    key: K,
    compare: (x: T[K]['value'], y: T[K]['value']) => boolean,
) {
    return distinctUntilKeyChanged<T, K>(key, (x, y) => (compare ? compare(x.value, y.value) : x.value === y.value));
}
