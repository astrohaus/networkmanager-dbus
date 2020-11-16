import { EthernetDevice, NetworkManager, WifiDevice } from ".";
import { Metered } from "./dbus-types";

let networkManager: NetworkManager;
let wifiDevice: WifiDevice;
let ethernetDevice: EthernetDevice;

async function start() {
    networkManager = await NetworkManager.init();
    wifiDevice = await networkManager.wifiDevice();
    ethernetDevice = await networkManager.ethernetDevice();

    networkManager.properties$.subscribe(properties => {
        console.log("nm props:");
        console.log(properties);
    });

    wifiDevice.properties$.subscribe(properties => {
        console.log("wifi properties:");
        console.log(properties);
    });

    wifiDevice.accessPoints$.subscribe(accessPoints => {
        console.log("access points:");
        console.log(accessPoints);
    });

    ethernetDevice.properties$.subscribe(properties => {
        console.log("ethernet device props:");
        console.log(properties);
    })
}

start();
