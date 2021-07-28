# NetworkManager DBus Client for NodeJS

## Credits

### [DBus-next](https://github.com/dbusjs/node-dbus-next)

This library powers the code that interacts with DBus.

### [Ian's Tech Blog – Fun With NetworkManager](http://cheesehead-techblog.blogspot.com/2012/09/dbus-tutorial-fun-with-network-manager.html)

Great tutorial on basic interaction with NetworkManager via DBus

## Introduction

NetworkManager is the program that manages network connections on Ubuntu and BalenaOS Systems (probably on some other Linux flavors too).
It's super powerful; you can configure a connection to pretty much any kind of network including:

- Enterprise WiFi
- Bluetooth
- Cellular Modems

This library provides some basic wrapper functionality for NodeJS apps. It was developed to perform basic wifi provisioning from within
an Electron app, but it'll work well with any NodeJS app.

## Installation

_Note_: This has only been tested on Ubuntu Linux. It should work fine on other Linux distros with some setup, and it supposedly works on Mac as well.

```terminal
npm install dbus-next networkmanager-dbus
```

## Examples

### Scan for Local Access Points

```typescript
import { NetworkManager } from 'network-manager-dbus';

let networkManager = await NetworkManager.init();
let wifiDevice = await networkManager.wifiDevice();

// Subscribe to discovered access points
wifiDevice.accessPoints$.subscribe((accessPoints) => {
  console.log(`access points:`);
  console.log(accessPoints);
});

// Requests a network scan
// Usually takes a few seconds to complete
// Access points will be updated
wifiDevice.requestScan();
```

### Connect to a non-enterprise Wifi Network

```typescript
import { NetworkManager, DeviceState } from 'network-manager-dbus';

let networkManager = await NetworkManager.init();
let wifiDevice = await networkManager.wifiDevice();
let connectionSettingsManager = await networkManager.connectionSettingsManager();

// Subscribe to WifiDevice properties
wifiDevice.properties$.subscribe((properties) => {
  console.log(`WiFi Status:`);
  console.log(`Connection state: ${DeviceState[properties.State.value]}`);
  if (properties.ActiveAccessPoint.value) {
    if (wifiDevice.accessPoints[properties.ActiveAccessPoint.value]) {
      console.log(`Connected to access point:`);
      console.log(wifiDevice.accessPoints[properties.ActiveAccessPoint.value]);
    } else {
      console.log(`Not connected to a discovered access point`);
    }
  } else {
    console.log(`Not connected to an Access Point`);
  }
});

let networkIsHidden = false;
let connectionProfilePath = await connectionSettingsManager.addWifiWpaConnection(
  'MY_SSID',
  networkIsHidden,
  'MY_PASSWORD',
);

// After the connection is activated, the wifiDevice.properties$ observable will update with
// a new ActiveAccessPoint
await wifiDevice.activateConnection(connectionProfilePath);
```

### Listen to Ethernet Cable Plug/Unplug Events

```typescript
import { NetworkManager } from 'network-manager-dbus';

let networkManager = await NetworkManager.init();
let ethernetDevice = await networkManager.ethernetDevice();

ethernetDevice.properties$.subscribe((properties) => {
  if (properties.Carrier.value) {
    console.log('Cable plugged in');
  } else {
    console.warn('Cable unplugged!');
  }
});
```

## Using this in Electron

This library was originally developed for use in an Electron app running on a [BalenaOS](https://www.balena.io/os/) device.

When in an electron app, you can only make calls to native/nodejs libraries in the main context (i.e. electron's main.js; not in your actual webapp).
However, you may still want to utilize proper types when passing information gathered from this library (like a list of local access points) to your render context.

Types for objects can be accessed by importing them from `networkmanager-dbus/lib/dbus-types` in your render context. This will not import any actual code,
just interfaces, enums, types, etc. Example:

```typescript
import { DeviceState } from `networkmanager-dbus/lib/dbus-types`;
```

## Contributing

Contributions are welcome! Just submit a PR on Gitlab.

## Additional Resources

- [Network Manager DBus API](https://developer.gnome.org/NetworkManager/stable/spec.html)

### Closing Remarks

This library was developed at [Dropworks](https://www.dropworks.com/introducing-continuum). We make a pretty incredible digital droplet PCR machine. If your lab needs an afforable and highly accurate PCR machine, keep us in mind! Additionally, if you're a developer that's looking to work on interesting projects with a great team, please check out our [job openings](https://www.dropworks.com/careers)!
