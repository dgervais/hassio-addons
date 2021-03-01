# Home Assistant Add-on: Ring Recorder

## Theory of Operation

The Ring Recorder Add-on will expose an HTTP endpoint that can trigger a Ring camera to record a video snapshot of a given duration. The video is recorded by connecting to the livestream of the camera, transcoding it into a video file, and preparing an object for download for viewing or local archiving.

In order to save battery and limit the amount of time that the Ring device is running, automations should be used to handle event transitions, select Ring cameras at a given location, and determine the filename to record. A delay can then be used to wait for the recording to finish and store the collected video to a download directory using the [downloader integration](https://www.home-assistant.io/integrations/downloader/) and a `downloader.download_file` service call.

The trigger should use motion or doorbell binary_sensor state transitions, such as:

```yaml
platform: state
entity_id: binary_sensor.front_door_motion
from: 'off'
to: 'on'
```

These state transitions can then be used to have a `downloader` service call to `downloader.download_file`:

```yaml
service: downloader.download_file
data:
  url: http://{{ states('sensor.local_ip') }}:8000/snapshot/location/{locationId}/camera/{cameraId}/duration/{duration}
  subdir: actions
  filename: last_motion_event.json
  overwrite: true
```
where `locationId`, `cameraId`, and `duration` are the Ring location identifier, Ring camera identifier, and the recording duration in seconds.

Also, [local_ip integration](https://www.home-assistant.io/integrations/local_ip/) can be used to dynamically determine the correct ip address to target your downloader requests to instead of hardcoding an ip address.

The assumption is that the configured `downloader` integration directory has been created along with any subseqently requested `subdir` locations requested when calling the `downloader.download_file` locations.

The snapshot request will queue a live recording to get generated. Once the recording is complete, it can be consumed following a [delayed action](https://www.home-assistant.io/docs/automation/action/) (typically a few seconds longer than the above duration requested).

```yaml
service: downloader.download_file
data:
  url: http://{{ states('sensor.local_ip') }}:8000/collect/location/{locationId}/camera/{cameraId}
  subdir: ring_front_door
  filename: motion_{{ now() }}.mp4
  overwrite: true
```

The [local media browser integration](https://www.home-assistant.io/integrations/media_source/#using-custom-or-additional-media-folders) can then be configured to view the downloaded video objects. For example, the following lines from your `configuration.yaml` should include:

```yaml
downloader:
  download_dir: downloads

homeassistant:
  media_dirs:
    media: /config/downloads/ring_front_door
```

Putting it all together, you would want to have the following in your `configuration.yaml`:

``` yaml
downloader:
  download_dir: downloads

homeassistant:
  media_dirs:
    media: /config/downloads/ring_front_door
```
where the `/config/downloads`, `/config/downloads/ring_front_door`, `/config/downloads/actions` folders have been created.

The automation can then call the following sequential actions to request, wait, and download the generated video file:

```yaml
service: downloader.download_file
data:
  url: http://{{ states('sensor.local_ip') }}:8000/snapshot/location/{locationId}/camera/{cameraId}/duration/30
  subdir: actions
  filename: last_frontdoor_motion_event.json
  overwrite: true
delay: 35
service: downloader.download_file
data:
  url: http://{{ states('sensor.local_ip') }}:8000/collect/location/{locationId}/camera/{cameraId}
  subdir: ring_front_door
  filename: motion_{{ now() }}.mp4
  overwrite: true
```

The Add-on will debounce multiple recording requests for the same location/camera if there is already a recording request in-queue. As such, multiple motion requests within the same time window will likely download the same recorded snapshot. If you template the filename, they will receive multiple similar copies.

## Installation

Add the addon via configuration of the traditional `Supervisor` and `Add-on Store` methods.

Add the ring refresh token under the addon's `Configuration` tab. Place the refresh token as a string in the `token` key. To obtain a token, use `npx -p ring-client-api ring-auth-cli`. Additional details can be found at https://github.com/dgreif/ring/wiki/Refresh-Tokens.

```json
{
  "token": "add the refresh token string here"
}
```

Configure `automations` to request and download video files.

The `locationId` and `cameraId` will be provided in the log file on startup. Check the logs for these values for each of your available locations and cameras.

Please note, that this addon will stop working when your refresh token expires.

## Support

This addon was created purely for my own purposes and, for now, does what I need. I welcome improvements, but I'm not sure how much time I can spare. If there are pressing issues, feel free to raise a github issue or provide a PR to help improve. Happy hacking.