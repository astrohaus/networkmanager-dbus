import { EthernetDevice } from "./src/ethernet-device";
import { NetworkManager } from "./src/network-manager";
import { WifiDevice } from "./src/wifi-device";

require('source-map-support').install();

console.log("what the heck iis uuuuup");

let networkManager: NetworkManager;
let wifiDevice: WifiDevice;
let ethernetDevice: EthernetDevice;

async function start() {
    networkManager = await NetworkManager.init();
    // networkManager.properties$.subscribe(properties => {
    //     console.log("Network manager properties observable:");
    //     console.log(properties);
    // });


    wifiDevice = await networkManager.wifiDevice();
    //await wifiDevice.requestScan();
    // wifiDevice.properties$.subscribe(properties => {
    //     console.log("Wifi device properties observable:");
    //     console.log(properties);
    // });

    wifiDevice.accessPoints$.subscribe(accessPoints => {
        console.log("Access points updated:");
        console.log(accessPoints);
    })

    // ethernetDevice = await networkManager.ethernetDevice();
    // ethernetDevice.properties$.subscribe(properties => {
    //     console.log("Ethernet device properties observable:");
    //     console.log(properties);
    // });
}


start();

console.log('heyas');