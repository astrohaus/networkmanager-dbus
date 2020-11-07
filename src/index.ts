import { NetworkManager } from "./network-manager";

console.log("what the heck iis uuuuup");

const networkManager = new NetworkManager();

async function start() {
    // let devices = await networkManager.getAllDevices();
    // console.log("devices:");
    // console.log(devices);
    // devices.forEach(async device => {
    //     let properties = await networkManager.getAllProperiesForDevice(device);
    //     console.log(`Properties for ${device}:`);
    //     console.log(properties);
    // });
    networkManager.getDiscoveredWifiNetworks();
}

start();

console.log('hey');