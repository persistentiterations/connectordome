# ConnectorDome ROS 2 read-only adapter

Status: **IMPLEMENTED BUT NOT INTEGRATION-TESTED**. This package has not been built in a ROS 2 environment in this repository.

It publishes a previously validated `connectordome.observation-frame/v0.3` file on `/connectordome/observation_frame` as canonical JSON in `std_msgs/String`. This conservative transport deliberately preserves the complete frame: source identity, measurement/retrieval times, reference identity, uncertainty declarations, provenance, exclusions, coverage, integrity digests, and `action_authority: NONE`.

It does not acquire data from the network, transform a remote environmental reading into robot-local state, publish commands, call services, or access actuators.

```bash
colcon build --packages-select connectordome_ros2_adapter
source install/setup.bash
ros2 run connectordome_ros2_adapter frame_publisher --ros-args -p frame_file:=/absolute/path/frame.json
```

Consumers must treat this topic as an observation frame, not pose, odometry, TF, command, safety certification, or authorization. A typed companion-message package is a next-step design item after ROS distribution build verification.
