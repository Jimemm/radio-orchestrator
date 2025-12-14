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

    let started = false
    let role: MyRole = MyRole.Device

    // pairing state
    let paired = false
    let group = 0
    let code = 0
    let deviceLetter = ""

    // master state
    let controllers: string[] = []
    let devices: string[] = []

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

        radio.setGroup(1)

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

        deviceLetter = (role === MyRole.Controller) ? "c" : "d"
        code = randint(1, 10000)

        radio.onReceivedValue(function (name: string, value: number) {
            if (!paired) {
                if (name == deviceLetter + code) {
                    paired = true
                    group = value
                    basic.showNumber(group)
                    radio.setGroup(group)
                }
            }
        })

        control.inBackground(function () {
            while (true) {
                if (!paired) {
                    basic.showIcon(IconNames.SmallDiamond)
                    radio.sendValue(deviceLetter, code)
                    basic.showIcon(IconNames.SmallSquare)
                    basic.showIcon(IconNames.Square)
                } else {
                    basic.showNumber(group)
                }
                basic.pause(300)
            }
        })
    }

    // =========================
    // MASTER (already implemented)
    // =========================

    function startMaster(): void {


        serial.writeValue("x", 1)

        radio.onReceivedValue(function (name: string, value: number) {
            serial.writeLine(name + "->" + value)
            basic.showIcon(IconNames.SmallHeart)

            let id = name + value

            if (name == "c") {
                basic.showIcon(IconNames.Heart)
                if (controllers.indexOf(id) < 0) {
                    basic.showIcon(IconNames.Yes)
                    controllers.push(id)
                }
            }
            else if (name == "d") {
                basic.showIcon(IconNames.Heart)
                if (devices.indexOf(id) < 0) {
                    basic.showIcon(IconNames.Yes)
                    devices.push(id)
                }
            }
        })

        control.inBackground(function () {
            while (true) {

                for (let c of controllers) {
                    serial.writeLine(c)
                    radio.sendValue(c, controllers.indexOf(c) + 2)
                }

                for (let d of devices) {
                    serial.writeLine(d)
                    radio.sendValue(d, devices.indexOf(d) + 2)
                }

                basic.pause(200)
            }
        })
    }
}
