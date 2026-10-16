"""Publish a validated ConnectorDome frame without converting it into robot state or control."""
import json
from pathlib import Path
import rclpy
from rclpy.node import Node
from std_msgs.msg import String

class FramePublisher(Node):
    def __init__(self):
        super().__init__('connectordome_frame_publisher')
        self.declare_parameter('frame_file', '')
        self.publisher = self.create_publisher(String, '/connectordome/observation_frame', 10)
        frame_file = self.get_parameter('frame_file').value
        if not frame_file:
            raise ValueError('frame_file is required; this adapter performs no network acquisition')
        frame = json.loads(Path(frame_file).read_text(encoding='utf-8'))
        if frame.get('schema') != 'connectordome.observation-frame/v0.3':
            raise ValueError('unsupported or unvalidated frame schema')
        if frame.get('action_authority') != 'NONE':
            raise ValueError('refusing a frame that declares action authority')
        self.message = String(data=json.dumps(frame, sort_keys=True, separators=(',', ':')))
        self.timer = self.create_timer(1.0, self.publish)

    def publish(self):
        self.publisher.publish(self.message)

def main():
    rclpy.init()
    node = FramePublisher()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        rclpy.shutdown()
