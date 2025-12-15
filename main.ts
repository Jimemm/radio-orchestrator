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
    const PEER_TIMEOUT = 3000

    // message names
    const MSG_PAIR = "p"
    const MSG_ASSIGN = "a"
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

            if (!paired && name === MSG_ASSIGN && value === myId) {
                paired = true
                lastPeerSeen = control.millis()
                radio.setGroup(group)
                basic.showIcon(IconNames.Yes)
                basic.showNumber(group)
                // return
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
                } else {
                    // heartbeat to peer
                    radio.sendValue(MSG_HEART, myId)
                }

                basic.pause(HEARTBEAT_INTERVAL)
            }
        })

        // loss detection
        control.inBackground(function () {
            while (true) {
                if (paired && control.millis() - lastPeerSeen > PEER_TIMEOUT) {

                    paired = false
                    peerId = 0
                    group = 0

                    radio.setGroup(MASTER_GROUP)
                    radio.sendValue(MSG_LOST, myId)

                    basic.showIcon(IconNames.No)
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

            // pairing request
            if (name === MSG_PAIR) {
                let r = getRole(value)
                serial.writeLine("[M] PAIR REQ " + r + ":" + value)

                if (r === ROLE_CONTROLLER && controllers.indexOf(value) < 0) {
                    controllers.push(value)
                    serial.writeLine("[M] ADD CONTROLLER " + value)
                }
                else if (r === ROLE_DEVICE && devices.indexOf(value) < 0) {
                    devices.push(value)
                    serial.writeLine("[M] ADD DEVICE " + value)
                }
            }

            // lost client
            if (name === MSG_LOST) {
                serial.writeLine("[M] LOST " + value)

                let i = controllers.indexOf(value)
                if (i >= 0) {
                    controllers.removeAt(i)
                    serial.writeLine("[M] LOST CONTROLLER " + value)
                }

                i = devices.indexOf(value)
                if (i >= 0) {
                    devices.removeAt(i)
                    serial.writeLine("[M] LOST DEVICE " + value)
                }
            }
        })

        // assignment loop
        control.inBackground(function () {
            while (true) {

                // assign controllers
                for (let i = 0; i < controllers.length; i++) {
                    let id = controllers[i]
                    let g = i + 2
                    // serial.writeLine("[M] ASSIGN CONTROLLER " + id + " -> G" + g)
                    radio.setGroup(MASTER_GROUP)
                    radio.sendValue(MSG_ASSIGN, id)
                    radio.setGroup(g)
                }

                // assign devices
                for (let i = 0; i < devices.length; i++) {
                    let id = devices[i]
                    let g = i + 2
                    // serial.writeLine("[M] ASSIGN DEVICE " + id + " -> G" + g)
                    radio.setGroup(MASTER_GROUP)
                    radio.sendValue(MSG_ASSIGN, id)
                    radio.setGroup(g)
                }

                basic.pause(500)
            }
        })
    }
}
