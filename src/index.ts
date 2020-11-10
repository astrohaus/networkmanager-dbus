import { NetworkManager } from "./network-manager";
require('source-map-support').install();

console.log("what the heck iis uuuuup");

const networkManager = new NetworkManager();


networkManager.accessPoints.subscribe(accessPoints => {
    console.log(`${accessPoints.length} access points discovered`);

});

networkManager.savedWifiSettings.subscribe(savedWifiSettingsMap => {
    console.log("saved wifi settings updated:");
    console.log(savedWifiSettingsMap);
})

networkManager.start();
networkManager.requestScan();


async function testAddConnection() {
    let result = await networkManager.addConnection("OKBWifi", "itiswhatit1s");
    console.log("added connection:");
    console.log(result);
}

testAddConnection();

console.log('hey');