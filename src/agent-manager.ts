import DBus from '@astrohaus/dbus-next';
import { call, objectInterface } from './util';

export class AgentManager {
    private _bus: DBus.MessageBus;
    private _agentManagerInterface: DBus.ClientInterface;

    public static OBJECT_PATH = '/org/freedesktop/NetworkManager/AgentManager';
    public static INTERFACE_NAME = 'org.freedesktop.NetworkManager.AgentManager';
    public static SECRET_AGENT_OBJECT_PATH = '/org/freedesktop/NetworkManager/SecretAgent';
    public static SECRET_AGENT_INTERFACE_NAME = 'org.freedesktop.NetworkManager.SecretAgent';

    private constructor(bus: DBus.MessageBus, agentManagerInterface: DBus.ClientInterface) {
        this._bus = bus;
        this._agentManagerInterface = agentManagerInterface;
    }

    public static async init(bus: DBus.MessageBus): Promise<AgentManager> {
        const agentManagerInterface = await objectInterface(bus, AgentManager.OBJECT_PATH, AgentManager.INTERFACE_NAME);

        return new AgentManager(bus, agentManagerInterface);
    }

    /**
     * Called by secret Agents to register their ability to provide and save network secrets.
     *
     * @param name Identifies this agent; only one agent in each user session may use the same identifier. Identifier
     *             formatting follows the same rules as D-Bus bus names with the exception that the `:` character is
     *             not allowed. The valid set of characters is `[A-Z][a-z][0-9]_-.` and the identifier is limited in
     *             length to 255 characters with a minimum of 3 characters. An example valid identifier is
     *             'org.gnome.nm-applet' (without quotes).
     */
    public register(name: string): Promise<void> {
        return call(this._agentManagerInterface, 'Register', name);
    }

    /**
     * Called by secret Agents to notify NetworkManager that they will no longer handle requests for network secrets.
     * Agents are automatically unregistered when they disconnect from D-Bus.
     */
    public unregister(): Promise<void> {
        return call(this._agentManagerInterface, 'Unregister');
    }

    /**
     * Exports SecretAgent interface to the bus.
     *
     * @param secretAgent instance that implements DBus interface for Secret Agent.
     */
    public addSecretAgent(secretAgent: DBus.interface.Interface): void {
        this._bus.export(AgentManager.SECRET_AGENT_OBJECT_PATH, secretAgent);
    }
}
