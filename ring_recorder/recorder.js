const ringclientapi = require('ring-client-api')
const console = require('console')
const express = require('express')
const path = require('path')
const fs = require('fs')

const { v4: uuidv4 } = require('uuid');

require('console-stamp')(console, '[yyyy-mm-dd HH:MM:ss.l]');

const app = express()
const port = 8000
const token = process.env.RING_REFRESH_TOKEN

var applicationReady = 0
var availableCameras = {}

process.on('SIGINT', function() {
    console.log("caught interrupt signal");
    process.exit();
});

async function cameraInfo() {
    try {
        const api = new ringclientapi.RingApi({refreshToken: token, debug: true})
        const locations = await api.getLocations()
        for(const location of locations) {
            const cameras = location.cameras
            const devices = await location.getDevices()
            if(cameras.length > 0) {
                availableCameras[location.id] = {}
            }
            console.log(`Location ${location.name} (${location.id}) has ${cameras.length} camera(s) and ${devices.length} devices(s):`)
            for(const camera of cameras) {
                availableCameras[location.id][camera.id] = 1 // set to 1 to allow recording
                console.log(`- camera ${camera.id}: ${camera.name} (${camera.deviceType})`)
            }
            for(const device of devices) {
                console.log(`- device ${device.zid}: ${device.name} (${device.deviceType})`)
            }
        }
        fs.readdirSync(__dirname).forEach(file => {
            if(file.endsWith('.mp4')) {
                fs.unlinkSync(file)
                console.log(`removing stale video file: ${file}`)
            }
        });     
    } catch(err) {
        console.error(err)
        process.exit()
    }
    applicationReady = 1 // set to 1 to signify device information collected
}
async function snapshot(locationId, cameraId, duration) {
    if(!(locationId in availableCameras)) { return }
    if(!(cameraId in availableCameras[locationId])) { return }
    if(!(availableCameras[locationId][cameraId])) {
        console.log(`debouncing request to locationId=${locationId} and cameraId=${cameraId}`)
        return
    }

    console.log(`locking access to locationId=${locationId} and cameraId=${cameraId}`)
    availableCameras[locationId][cameraId] = 0
    try {
        const api = new ringclientapi.RingApi({refreshToken: token, debug: true})
        const locations = await api.getLocations()
        var location = null
        var camera = null
        for(location of locations) {
            if(locationId!=location.id) { continue }
            cameras = location.cameras
            for(camera of cameras) {
                if(cameraId!=camera.id) { continue }
            }
        }
        if(camera==null) {
            throw(`no camera found!!! requested locationId=${locationId} and cameraId=${cameraId}`)
        }

        const tmpFilename = path.join(__dirname, "tmp_" + uuidv4() + ".mp4")
        const filename = path.join(__dirname, `${location.id}.${camera.id}.mp4`)
        console.log(`video snapshot recording requested: using ${tmpFilename}`)
        await camera.recordToFile(tmpFilename, duration)
        fs.renameSync(tmpFilename, filename)
        console.log(`video snapshot ready: ${tmpFilename} renamed to ${filename}`)
     } catch(err) {
         console.error(err)
    }
    console.log(`unlocking access to locationId=${locationId} and cameraId=${cameraId}`)
    availableCameras[locationId][cameraId] = 1
}

app.get('/status', (req, res) => {
    const cinfo = JSON.stringify(availableCameras)
    res.send(`applicationReady = ${applicationReady}\n${cinfo}`)
})

app.get('/snapshot/location/:locationId/camera/:cameraId/duration/:duration', (req, res) => {
    if(!applicationReady) {
        console.log("request received, but application is not yet ready")
        res.sendStatus(503)
        return
    }
    const locationId = req.params["locationId"]
    const cameraId = req.params["cameraId"]
    const duration = parseInt(req.params["duration"])
    const ctime = Date()

    if(!(locationId in availableCameras)) {
        console.log(`requested locationId=${locationId} does not exist`)
        res.sendStatus(404)
        return
    }

    if(!(cameraId in availableCameras[locationId])) {
        console.log(`requested cameraId=${cameraId} does not exist in locationId=${locationId}`)
        res.sendStatus(404)
        return
    }

    if(Number.isNaN(duration)) {
        console.log(`requested duration of ${duration} is NaN for locationId=${locationId} and cameraId=${cameraId}`)
        res.sendStatus(404)
        return
    }
    if(duration < 1) {
        console.log(`requested duration of ${duration} is too short for locationId=${locationId} and cameraId=${cameraId}`)
        res.sendStatus(404)
        return
    }
    if(duration > 120) {
        console.log(`requested duration of ${duration} is too long for locationId=${locationId} and cameraId=${cameraId}`)
        res.sendStatus(404)
        return
    }
    snapshot(locationId, cameraId, duration)
    const ret = {}
    ret["locationId"] = locationId
    ret["cameraId"] = cameraId
    ret["duration"] = duration
    ret["time"] = ctime
    res.setHeader("Content-Type", "application/json")
    res.send(JSON.stringify(ret))
})

app.get('/collect/location/:locationId/camera/:cameraId', (req, res) => {
    if(!applicationReady) {
        console.log("request received, but application is not yet ready")
        res.sendStatus(503)
        return
    }
    const locationId = req.params["locationId"]
    const cameraId = req.params["cameraId"]
    if(!(locationId in availableCameras)) {
        console.log(`requested locationId=${locationId} does not exist`)
        res.sendStatus(404)
        return
    }

    if(!(cameraId in availableCameras[locationId])) {
        console.log(`requested cameraId=${cameraId} does not exist in locationId=${locationId}`)
        res.sendStatus(404)
        return
    }

    const filename = path.join(__dirname, `${locationId}.${cameraId}.mp4`)
    console.log(`collecting video file ${filename} from locationId=${locationId} on cameraId=${cameraId}`)
    res.sendFile(filename)
})

app.listen(port, () => {
    console.log(`ring recorder app listening at http://localhost:${port}`)
    if(!token) {
        console.log("could not find RING_REFRESH_TOKEN")
        process.exit()
    }
    console.log("token extracted from RING_REFRESH_TOKEN=<omitted>")
    cameraInfo()
})
