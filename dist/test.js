"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _1 = require(".");
require('source-map-support').install();
console.log('what the heck iis uuuuup');
let networkManager;
async function start() {
    networkManager = await _1.NetworkManager.init();
    networkManager.accessPoints$.subscribe((accessPoints) => {
        console.log(`Access points: ${accessPoints.length}`);
    });
    networkManager.networkManagerProperties$.subscribe((properties) => {
        console.log('Updated network manager properties:');
        console.log(properties);
    });
    //await networkManager.requestScan();
    let connectionPath = await networkManager.addNewWpaConnection(25, 'farts', 'itiswhatit1s');
    let activeConnectionPath = await networkManager.activateConnection(connectionPath);
    console.log(`Activated connection with path: ${activeConnectionPath}`);
    //await networkManager.wifiAutoConnectEnabled(true);
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
console.log('hes');
//# sourceMappingURL=test.js.map