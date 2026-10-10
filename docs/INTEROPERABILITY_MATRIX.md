# Interoperability matrix

This is an investigation map, not a list of shipped integrations.

| Standard/system | Reusable role | Missing ConnectorDome boundary | Current status |
| --- | --- | --- | --- |
| W3C Web of Things TD 1.1 | Thing metadata; properties, actions, events, security metadata | Local qualification and consequence-evidence policy | Candidate adapter; not implemented |
| MQTT 5.0 | Lightweight publish/subscribe transport, expiry, reason codes | Payload semantics, ownership, safety, evidence | Candidate transport; not implemented |
| OPC UA | Industrial information models, methods, programs, state machines | Cross-owner formation and ConnectorDome receipts | Candidate adapter; not implemented |
| ROS 2 | Robotics messaging and lifecycle ecosystem | Owner-local authority across heterogeneous non-ROS endpoints | Candidate adapter; not implemented |
| OGC SensorThings 1.1 | Standard sensing entities and observations | Execution authority and consequences | Observation adapter candidate; not implemented |
| ETSI NGSI-LD | Context entities, subscriptions, federated context sources | Endpoint-local permission and execution evidence | Context adapter candidate; not implemented |
| MCP | Tools/resources interface for AI applications | Device safety, physical truth, and local authorization | Developer-tool adapter candidate; not implemented |
| ASF/ReceptorEvent v0.1 | Production observation/provenance envelope | Deliberately no execution authority | Functioning in v0.1 |
| ConnectorDome alpha contracts | Capability, formation, extension, receipt boundaries | No live transports or devices | Functioning simulation only |

Primary specifications: [W3C WoT TD 1.1](https://www.w3.org/TR/wot-thing-description11/), [OASIS MQTT 5.0](https://docs.oasis-open.org/mqtt/mqtt/v5.0/mqtt-v5.0.html), [OPC UA reference](https://reference.opcfoundation.org/), [ROS 2 documentation](https://docs.ros.org/), [OGC SensorThings 1.1](https://docs.ogc.org/is/18-088/18-088.html), [ETSI NGSI-LD](https://cim.etsi.org/NGSI-LD/official/), and [MCP specification](https://modelcontextprotocol.io/specification/).

SPDX-License-Identifier: Apache-2.0
