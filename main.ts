/**
 * Functions are mapped to blocks using various macros
 * in comments starting with %. The most important macro
 * is "block", and it specifies that a block should be
 * generated for an **exported** function.
 */

enum MyRole {
    //% block="master"
    Master,
    //% block="controller"
    Controller,
    //% block="device"
    Device
}

//% color=#333333 icon="\uf11c"
namespace myextension {

    // =========================
    // CONSTANTS / PROTOCOL
    // =========================

    const MASTER_GROUP = 1
    const HEARTBEAT_INTERVAL = 500
    const PAIR_INTERVAL = 200
    const PEER_TIMEOUT = 5 * HEARTBEAT_INTERVAL

    // message names
    const MSG_PAIR = "p"
    const MSG_ACK = "a"
    const MSG_C_ACK = "c"
    const MSG_HEART = "h"
    const MSG_LOST = "l"

    // role numbers for encoding
    const ROLE_CONTROLLER = 1
    const ROLE_DEVICE = 2

    // =========================
    // GLOBAL STATE
    // =========================

    let started = false
    let role: MyRole = MyRole.Device

    // client state
    let paired = false
    let group = 0
    let code = 0
    let myId = 0
    let peerId = 0
    let lastPeerSeen = 0

    // master state
    let controllers: number[] = []
    let devices: number[] = []

    let controllers_ack: boolean[] = []
    let devices_ack: boolean[] = []


    // =========================
    // ID HELPERS
    // =========================

    function makeId(roleNum: number, code: number): number {
        return roleNum * 100000 + code
    }

    function getRole(id: number): number {
        return Math.idiv(id, 100000)
    }

    // =========================
    // START
    // =========================

    /**
     * Start my extension
     */
    //% block="start my extension as %r"
    //% r.defl=MyRole.Device
    //% weight=100
    export function start(r: MyRole): void {
        if (started) return
        started = true
        role = r

        radio.setGroup(MASTER_GROUP)

        if (role === MyRole.Master) {
            startMaster()
        } else {
            startClient()
        }
    }

    // =========================
    // CLIENT (controller/device)
    // =========================

    function startClient(): void {

        paired = false
        group = 0
        peerId = 0

        code = randint(1, 99999)

        let roleNum = (role === MyRole.Controller)
            ? ROLE_CONTROLLER
            : ROLE_DEVICE

        myId = makeId(roleNum, code)

        radio.onReceivedValue(function (name: string, value: number) {

            if (!paired && name === myId.toString()) {
                paired = true
                group = value
                basic.showNumber(group)
                serial.writeLine("[C] GROUP " + group)
                // return
            }

            if (paired && name === myId.toString()) {
                radio.sendValue(MSG_C_ACK, myId)
                serial.writeLine("[C] SENT ACK " + myId)
            }

            if (paired && name === MSG_ACK && value === myId) {
                basic.showIcon(IconNames.Yes)
                radio.setGroup(group)
                serial.writeLine("[C] GOT ACK " + value)
            }

            if (peerId == 0) {
                if (name == MSG_HEART) {
                    peerId = value
                    serial.writeLine("[C] FOUND PEER " + peerId)
                }
            }

            // heartbeat from peer (on paired group)
            if (paired && name === MSG_HEART && value === peerId) {
                lastPeerSeen = control.millis()
            }
        })

        // pairing + heartbeat sender
        control.inBackground(function () {
            while (true) {

                if (!paired) {
                    // pairing request to master
                    radio.setGroup(MASTER_GROUP)
                    radio.sendValue(MSG_PAIR, myId)
                    basic.showIcon(IconNames.SmallDiamond)
                    basic.pause(PAIR_INTERVAL)
                } else {
                    // heartbeat to peer
                    radio.sendValue(MSG_HEART, myId)
                    basic.pause(HEARTBEAT_INTERVAL)
                }

            }
        })

        // loss detection
        control.inBackground(function () {
            while (true) {
                if (paired && peerId != 0 && control.millis() - lastPeerSeen > PEER_TIMEOUT) {

                    paired = false
                    peerId = 0

                    radio.setGroup(MASTER_GROUP)
                    radio.sendValue(MSG_LOST, myId)

                    // basic.showIcon(IconNames.No)
                }
                basic.pause(500)
            }
        })
    }

    // =========================
    // MASTER
    // =========================

    function startMaster(): void {

        serial.writeLine("[M] START")

        radio.onReceivedValue(function (name: string, value: number) {

            if (name === MSG_C_ACK) {
                let i = devices.indexOf(value)
                if (i >= 0) {
                    devices_ack[i] = true
                    serial.writeLine("[M] LOST DEVICE " + value)
                }

                i = controllers.indexOf(value)
                if (i >= 0) {
                    controllers_ack[i] = true
                    serial.writeLine("[M] LOST CONTROLLER " + value)
                }
            }

            // pairing request
            if (name === MSG_PAIR) {
                let r = getRole(value)
                serial.writeLine("[M] PAIR REQ " + r + ":" + value)

                if (r === ROLE_CONTROLLER && controllers.indexOf(value) < 0) {
                    let next_available = controllers.indexOf(-1)
                    if (next_available >= 0) {
                        controllers[next_available] = value
                        controllers_ack[next_available] = false
                        serial.writeLine("[M] REASSIGN CONTROLLER " + value + " (" + next_available + ")")
                    } else {
                        controllers.push(value)
                        controllers_ack.push(false)
                        serial.writeLine("[M] ADD CONTROLLER " + value)
                    }

                }
                else if (r === ROLE_DEVICE && devices.indexOf(value) < 0) {
                    let next_available = devices.indexOf(-1)
                    if (next_available >= 0) {
                        devices[next_available] = value
                        devices_ack[next_available] = false
                        serial.writeLine("[M] REASSIGN DEVICE " + value + " (" + next_available + ")")
                    } else {
                        devices.push(value)
                        devices_ack.push(false)
                        serial.writeLine("[M] ADD DEVICE " + value)
                    }
                }
            }

            // lost client
            if (name === MSG_LOST) {
                serial.writeLine("[M] LOST " + value)

                let i = controllers.indexOf(value)
                if (i >= 0) {
                    devices[i] = -1
                    serial.writeLine("[M] LOST DEVICE " + value)
                }

                i = devices.indexOf(value)
                if (i >= 0) {
                    controllers[i] = -1
                    serial.writeLine("[M] LOST CONTROLLER " + value)
                }
            }
        })

        // assignment loop
        control.inBackground(function () {

            while (true) {
                // assign controllers
                for (let i = 0; i < controllers_ack.length; i++) {
                    if (!controllers_ack[i]) {
                        let id = controllers[i]
                        let g = i + 2
                        serial.writeLine("[M] ASSIGN CONTROLLER " + id + " -> G" + g)
                        radio.setGroup(MASTER_GROUP)
                        radio.sendValue(id.toString(), g)
                    } else {
                        radio.sendValue(MSG_ACK, controllers[i])
                    }
                }

                // assign devices
                for (let i = 0; i < devices_ack.length; i++) {
                    if (!devices_ack[i]) {
                        let id = devices[i]
                        let g = i + 2
                        serial.writeLine("[M] ASSIGN DEVICE " + id + " -> G" + g)
                        radio.setGroup(MASTER_GROUP)
                        radio.sendValue(id.toString(), g)
                    } else {
                        radio.sendValue(MSG_ACK, controllers[i])
                    }
                }

                basic.pause(500)
            }
        })
    }
}
