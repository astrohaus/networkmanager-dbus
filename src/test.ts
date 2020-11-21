import { EthernetDevice, NetworkManager, WifiDevice } from ".";
import { ConnectionSettingsManager } from "./connection-settings-manager";
import { Metered } from "./dbus-types";

let networkManager: NetworkManager;
let wifiDevice: WifiDevice;
let ethernetDevice: EthernetDevice;
let connectionSettingsManager: ConnectionSettingsManager;

async function start() {
    networkManager = await NetworkManager.init();
    wifiDevice = await networkManager.wifiDevice();
    ethernetDevice = await networkManager.ethernetDevice();
    connectionSettingsManager = await networkManager.connectionSettingsManager();

    networkManager.properties$.subscribe(properties => {
        console.log("nm props:");
        console.log(properties);
    });

    // wifiDevice.properties$.subscribe(properties => {
    //     console.log(`wifi properties:`);
    //     console.log(properties);
    // });

    // wifiDevice.accessPoints$.subscribe(accessPoints => {
    //     console.log(`access points:`);
    //     console.log(accessPoints);
    // });

    // ethernetDevice.properties$.subscribe(properties => {
    //     console.log("ethernet device props:");
    //     console.log(properties);
    // });

    // connectionSettingsManager.connectionProfiles$.subscribe(profiles => {
    //     console.log("Connection profiles:");
    //     console.log(profiles);
    // });

    //connectionSettingsManager.addWifiConnection("OKBIoT", true);

    //let settingsPath = await connectionSettingsManager.addWifiConnection("OKBIoT", true);
    // let settingsPath = "/org/freedesktop/NetworkManager/Settings/13";
    // console.log(`CONNECTION ADDED: ${settingsPath}`);
    // let activeConnectionPath = await wifiDevice.activateConnection(settingsPath);
    // console.log(`ACTIVE CONNECTION: ${activeConnectionPath}`);
}

start();
