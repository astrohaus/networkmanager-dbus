import { NetworkManager } from "./network-manager";

console.log("what the heck iis uuuuup");

const networkManager = new NetworkManager();
networkManager.start();
networkManager.requestScan();

networkManager.localNetworks.subscribe(localNetworks => {
    console.log("local networks updated:");
    //console.log(localNetworks);
})

console.log('hey');