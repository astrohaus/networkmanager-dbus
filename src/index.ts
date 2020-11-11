import { NetworkManager } from "./network-manager";
require('source-map-support').install();

console.log("what the heck iis uuuuup");

let networkManager: NetworkManager;
async function start() {
    networkManager = await NetworkManager.init();
    networkManager.accessPoints$.subscribe(accessPoints => {
        console.log(accessPoints);
    });
    await networkManager.requestScan();
    let connectionPath = await networkManager.addNewWpaConnection("OKBWifi-5G", "itiswhatit1s");
    //console.log(`added a connection: ${connectionPath}`);
}


// networkManager.accessPoints.subscribe(accessPoints => {
//     console.log(`${accessPoints.length} access points discovered`);

// });

// networkManager.savedWifiSettings.subscribe(savedWifiSettingsMap => {
//     console.log("saved wifi settings updated:");
//     console.log(Object.keys(savedWifiSettingsMap));
// })

// networkManager.start();
// networkManager.requestScan();


// async function testAddConnection() {
//     let result = await networkManager.addConnection("OKBWifi", "itiswhatit1s");
//     console.log("added connection:");
//     console.log(result);
// }

// testAddConnection();

start();

console.log('heyas');