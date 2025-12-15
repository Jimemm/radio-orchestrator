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
    const MSG_PAIR = "p"   // pairing request
    const MSG_ASSIGN = "a" // assignment
    const MSG_HEART = "h"  // heartbeat
    const MSG_LOST = "l"   // lost peer

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

            // assignment from master (on group 1)
            if (!paired && name === MSG_ASSIGN && value === myId) {
                paired = true
                lastPeerSeen = control.millis()
                radio.setGroup(group)
                basic.showIcon(IconNames.Yes)
                return
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

        radio.onReceivedValue(function (name: string, value: number) {

            // pairing request
            if (name === MSG_PAIR) {
                let r = getRole(value)

                if (r === ROLE_CONTROLLER && controllers.indexOf(value) < 0) {
                    controllers.push(value)
                }
                else if (r === ROLE_DEVICE && devices.indexOf(value) < 0) {
                    devices.push(value)
                }
            }

            // lost client
            if (name === MSG_LOST) {
                let i = controllers.indexOf(value)
                if (i >= 0) controllers.removeAt(i)

                i = devices.indexOf(value)
                if (i >= 0) devices.removeAt(i)
            }
        })

        // assignment loop
        control.inBackground(function () {
            while (true) {

                // assign controllers
                for (let i = 0; i < controllers.length; i++) {
                    radio.setGroup(MASTER_GROUP)
                    radio.sendValue(MSG_ASSIGN, controllers[i])
                    radio.setGroup(i + 2)
                }

                // assign devices
                for (let i = 0; i < devices.length; i++) {
                    radio.setGroup(MASTER_GROUP)
                    radio.sendValue(MSG_ASSIGN, devices[i])
                    radio.setGroup(i + 2)
                }

                basic.pause(500)
            }
        })
    }
}
