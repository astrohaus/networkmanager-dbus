import { NetworkManager } from "./network-manager";
import { WifiDevice } from "./wifi-device";

require('source-map-support').install();

console.log("what the heck iis uuuuup");

let networkManager: NetworkManager;
let wifiDevice: WifiDevice;

async function start() {
    networkManager = await NetworkManager.init();
    networkManager.properties$.subscribe(properties => {
        console.log("Network manager properties observable:");
        console.log(properties);
    });


    wifiDevice = await networkManager.wifiDevice();

    wifiDevice.properties$.subscribe(properties => {
        console.log("Wifi device properties observable:");
        console.log(properties);
    });
}


start();

console.log('heyas');