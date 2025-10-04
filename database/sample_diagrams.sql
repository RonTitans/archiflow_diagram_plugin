-- Sample Network Diagrams for ArchiFlow
-- These are complex network architecture diagrams in Draw.io mxGraphModel format

-- Clear existing sample data (optional)
-- DELETE FROM archiflow.diagrams WHERE title LIKE 'Sample:%';

-- Sample 1: Data Center Network Architecture
INSERT INTO archiflow.diagrams (id, site_id, site_name, title, description, diagram_data, deployment_status, created_at, modified_at, created_by, modified_by)
VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    1,
    'Main Site',
    'Data Center Core Network',
    'Main data center network topology with redundant core switches, distribution layer, and access layer',
    '<mxGraphModel dx="1422" dy="754" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="core1" value="Core Switch 1&#xa;10.0.0.1" style="image;html=1;image=img/lib/clip_art/networking/Switch_128x128.png" vertex="1" parent="1">
          <geometry x="300" y="100" width="80" height="80" as="geometry"/>
        </mxCell>
        <mxCell id="core2" value="Core Switch 2&#xa;10.0.0.2" style="image;html=1;image=img/lib/clip_art/networking/Switch_128x128.png" vertex="1" parent="1">
          <geometry x="500" y="100" width="80" height="80" as="geometry"/>
        </mxCell>
        <mxCell id="fw1" value="Firewall 1&#xa;10.0.1.1" style="image;html=1;image=img/lib/clip_art/networking/Firewall_128x128.png" vertex="1" parent="1">
          <geometry x="200" y="250" width="80" height="80" as="geometry"/>
        </mxCell>
        <mxCell id="fw2" value="Firewall 2&#xa;10.0.1.2" style="image;html=1;image=img/lib/clip_art/networking/Firewall_128x128.png" vertex="1" parent="1">
          <geometry x="600" y="250" width="80" height="80" as="geometry"/>
        </mxCell>
        <mxCell id="dist1" value="Distribution SW 1&#xa;10.0.2.1" style="image;html=1;image=img/lib/clip_art/networking/Switch_128x128.png" vertex="1" parent="1">
          <geometry x="250" y="400" width="60" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="dist2" value="Distribution SW 2&#xa;10.0.2.2" style="image;html=1;image=img/lib/clip_art/networking/Switch_128x128.png" vertex="1" parent="1">
          <geometry x="550" y="400" width="60" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="access1" value="Access SW 1&#xa;10.0.3.1" style="image;html=1;image=img/lib/clip_art/computers/Server_128x128.png" vertex="1" parent="1">
          <geometry x="150" y="550" width="50" height="50" as="geometry"/>
        </mxCell>
        <mxCell id="access2" value="Access SW 2&#xa;10.0.3.2" style="image;html=1;image=img/lib/clip_art/computers/Server_128x128.png" vertex="1" parent="1">
          <geometry x="350" y="550" width="50" height="50" as="geometry"/>
        </mxCell>
        <mxCell id="access3" value="Access SW 3&#xa;10.0.3.3" style="image;html=1;image=img/lib/clip_art/computers/Server_128x128.png" vertex="1" parent="1">
          <geometry x="450" y="550" width="50" height="50" as="geometry"/>
        </mxCell>
        <mxCell id="access4" value="Access SW 4&#xa;10.0.3.4" style="image;html=1;image=img/lib/clip_art/computers/Server_128x128.png" vertex="1" parent="1">
          <geometry x="650" y="550" width="50" height="50" as="geometry"/>
        </mxCell>
        <mxCell id="edge1" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=3;strokeColor=#FF0000;" edge="1" parent="1" source="core1" target="core2">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="edge2" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=2;" edge="1" parent="1" source="core1" target="fw1">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="edge3" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=2;" edge="1" parent="1" source="core2" target="fw2">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="edge4" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=2;strokeColor=#0000FF;" edge="1" parent="1" source="fw1" target="fw2">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="edge5" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;" edge="1" parent="1" source="fw1" target="dist1">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="edge6" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;" edge="1" parent="1" source="fw2" target="dist2">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="edge7" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;dashed=1;" edge="1" parent="1" source="dist1" target="dist2">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="edge8" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;" edge="1" parent="1" source="dist1" target="access1">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="edge9" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;" edge="1" parent="1" source="dist1" target="access2">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="edge10" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;" edge="1" parent="1" source="dist2" target="access3">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="edge11" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;" edge="1" parent="1" source="dist2" target="access4">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="vlan1" value="VLAN 100: Management&#xa;10.100.0.0/24" style="swimlane;fillColor=#d5e8d4;strokeColor=#82b366;" vertex="1" parent="1">
          <geometry x="100" y="650" width="200" height="100" as="geometry"/>
        </mxCell>
        <mxCell id="vlan2" value="VLAN 200: Production&#xa;10.200.0.0/24" style="swimlane;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1">
          <geometry x="320" y="650" width="200" height="100" as="geometry"/>
        </mxCell>
        <mxCell id="vlan3" value="VLAN 300: DMZ&#xa;10.300.0.0/24" style="swimlane;fillColor=#f8cecc;strokeColor=#b85450;" vertex="1" parent="1">
          <geometry x="540" y="650" width="200" height="100" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>',
    'deployed',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '2 days',
    'admin',
    'admin'
);

-- Sample 2: AWS Cloud Architecture
INSERT INTO archiflow.diagrams (id, site_id, site_name, title, description, diagram_data, deployment_status, created_at, modified_at, created_by, modified_by)
VALUES (
    'b2c3d4e5-f678-90ab-cdef-123456789012',
    2,
    'East Coast DC',
    'AWS Multi-Region Architecture',
    'Multi-region AWS cloud architecture with VPCs, subnets, and services',
    '<mxGraphModel dx="1422" dy="754" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1400" pageHeight="850" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="region1" value="AWS US-East-1" style="swimlane;fillColor=#fff2cc;strokeColor=#d6b656;fontSize=14;fontStyle=1" vertex="1" parent="1">
          <geometry x="50" y="50" width="600" height="700" as="geometry"/>
        </mxCell>
        <mxCell id="vpc1" value="VPC: 10.0.0.0/16" style="swimlane;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="region1">
          <geometry x="20" y="40" width="560" height="640" as="geometry"/>
        </mxCell>
        <mxCell id="pubsub1" value="Public Subnet&#xa;10.0.1.0/24" style="swimlane;fillColor=#d5e8d4;strokeColor=#82b366;" vertex="1" parent="vpc1">
          <geometry x="20" y="40" width="250" height="200" as="geometry"/>
        </mxCell>
        <mxCell id="alb" value="Application&#xa;Load Balancer" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;" vertex="1" parent="pubsub1">
          <geometry x="75" y="40" width="100" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="nat1" value="NAT Gateway&#xa;10.0.1.5" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;" vertex="1" parent="pubsub1">
          <geometry x="75" y="120" width="100" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="privsub1" value="Private Subnet&#xa;10.0.2.0/24" style="swimlane;fillColor=#f8cecc;strokeColor=#b85450;" vertex="1" parent="vpc1">
          <geometry x="290" y="40" width="250" height="200" as="geometry"/>
        </mxCell>
        <mxCell id="ec2-1" value="EC2 Instance&#xa;Web Server 1" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="privsub1">
          <geometry x="20" y="40" width="100" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="ec2-2" value="EC2 Instance&#xa;Web Server 2" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="privsub1">
          <geometry x="130" y="40" width="100" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="ec2-3" value="EC2 Instance&#xa;App Server 1" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="privsub1">
          <geometry x="20" y="120" width="100" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="ec2-4" value="EC2 Instance&#xa;App Server 2" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="privsub1">
          <geometry x="130" y="120" width="100" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="dbsub1" value="Database Subnet&#xa;10.0.3.0/24" style="swimlane;fillColor=#e1d5e7;strokeColor=#9673a6;" vertex="1" parent="vpc1">
          <geometry x="20" y="260" width="520" height="180" as="geometry"/>
        </mxCell>
        <mxCell id="rds1" value="RDS Primary&#xa;PostgreSQL" style="shape=cylinder;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;fillColor=#d5e8d4;strokeColor=#82b366;" vertex="1" parent="dbsub1">
          <geometry x="100" y="50" width="100" height="100" as="geometry"/>
        </mxCell>
        <mxCell id="rds2" value="RDS Standby&#xa;PostgreSQL" style="shape=cylinder;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="dbsub1">
          <geometry x="320" y="50" width="100" height="100" as="geometry"/>
        </mxCell>
        <mxCell id="cache" value="ElastiCache&#xa;Redis Cluster" style="ellipse;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;" vertex="1" parent="dbsub1">
          <geometry x="210" y="50" width="100" height="100" as="geometry"/>
        </mxCell>
        <mxCell id="s3" value="S3 Bucket&#xa;Static Assets" style="shape=cylinder;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;fillColor=#f8cecc;strokeColor=#b85450;" vertex="1" parent="vpc1">
          <geometry x="230" y="470" width="100" height="100" as="geometry"/>
        </mxCell>
        <mxCell id="igw" value="Internet&#xa;Gateway" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffe6cc;strokeColor=#d79b00;" vertex="1" parent="region1">
          <geometry x="250" y="10" width="100" height="30" as="geometry"/>
        </mxCell>
        <mxCell id="region2" value="AWS EU-West-1" style="swimlane;fillColor=#fff2cc;strokeColor=#d6b656;fontSize=14;fontStyle=1" vertex="1" parent="1">
          <geometry x="700" y="50" width="600" height="700" as="geometry"/>
        </mxCell>
        <mxCell id="vpc2" value="VPC: 10.1.0.0/16" style="swimlane;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="region2">
          <geometry x="20" y="40" width="560" height="400" as="geometry"/>
        </mxCell>
        <mxCell id="dr-site" value="Disaster Recovery Site" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;fontSize=16;fontStyle=1" vertex="1" parent="vpc2">
          <geometry x="180" y="150" width="200" height="100" as="geometry"/>
        </mxCell>
        <mxCell id="cloudfront" value="CloudFront CDN" style="ellipse;shape=cloud;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;" vertex="1" parent="1">
          <geometry x="550" y="10" width="200" height="80" as="geometry"/>
        </mxCell>
        <mxCell id="route53" value="Route 53 DNS" style="ellipse;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;" vertex="1" parent="1">
          <geometry x="800" y="10" width="120" height="80" as="geometry"/>
        </mxCell>
        <mxCell id="edge1" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=2;strokeColor=#FF0000;" edge="1" parent="1" source="igw" target="alb">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="edge2" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=2;" edge="1" parent="1" source="alb" target="ec2-1">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="edge3" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=2;" edge="1" parent="1" source="alb" target="ec2-2">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="edge4" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=2;dashed=1;" edge="1" parent="1" source="rds1" target="rds2">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="edge5" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=3;strokeColor=#0000FF;" edge="1" parent="1" source="vpc1" target="vpc2">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>',
    'draft',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '1 day',
    'architect',
    'architect'
);

-- Sample 3: Kubernetes Cluster Network
INSERT INTO archiflow.diagrams (id, site_id, site_name, title, description, diagram_data, deployment_status, created_at, modified_at, created_by, modified_by)
VALUES (
    'c3d4e5f6-7890-abcd-ef12-345678901234',
    3,
    'West Coast DC',
    'Kubernetes Production Cluster',
    'K8s cluster with multiple namespaces, ingress controller, and service mesh',
    '<mxGraphModel dx="1422" dy="754" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1200" pageHeight="800" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="cluster" value="Kubernetes Cluster" style="swimlane;fillColor=#f5f5f5;strokeColor=#666666;fontSize=16;fontStyle=1" vertex="1" parent="1">
          <geometry x="50" y="50" width="1100" height="700" as="geometry"/>
        </mxCell>
        <mxCell id="master" value="Control Plane" style="swimlane;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="cluster">
          <geometry x="20" y="40" width="1060" height="150" as="geometry"/>
        </mxCell>
        <mxCell id="api" value="API Server&#xa;kube-apiserver" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;" vertex="1" parent="master">
          <geometry x="50" y="40" width="120" height="80" as="geometry"/>
        </mxCell>
        <mxCell id="etcd" value="etcd&#xa;Distributed KV Store" style="shape=cylinder;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;" vertex="1" parent="master">
          <geometry x="200" y="40" width="120" height="80" as="geometry"/>
        </mxCell>
        <mxCell id="scheduler" value="Scheduler&#xa;kube-scheduler" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;" vertex="1" parent="master">
          <geometry x="350" y="40" width="120" height="80" as="geometry"/>
        </mxCell>
        <mxCell id="controller" value="Controller Manager&#xa;kube-controller" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;" vertex="1" parent="master">
          <geometry x="500" y="40" width="120" height="80" as="geometry"/>
        </mxCell>
        <mxCell id="ccm" value="Cloud Controller&#xa;Manager" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffe6cc;strokeColor=#d79b00;" vertex="1" parent="master">
          <geometry x="650" y="40" width="120" height="80" as="geometry"/>
        </mxCell>
        <mxCell id="ingress-controller" value="NGINX Ingress&#xa;Controller" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#b0e3e6;strokeColor=#0e8088;" vertex="1" parent="master">
          <geometry x="800" y="40" width="120" height="80" as="geometry"/>
        </mxCell>
        <mxCell id="node1" value="Worker Node 1" style="swimlane;fillColor=#e1d5e7;strokeColor=#9673a6;" vertex="1" parent="cluster">
          <geometry x="20" y="210" width="340" height="470" as="geometry"/>
        </mxCell>
        <mxCell id="kubelet1" value="kubelet" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="node1">
          <geometry x="20" y="30" width="80" height="40" as="geometry"/>
        </mxCell>
        <mxCell id="kproxy1" value="kube-proxy" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="node1">
          <geometry x="120" y="30" width="80" height="40" as="geometry"/>
        </mxCell>
        <mxCell id="runtime1" value="containerd" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="node1">
          <geometry x="220" y="30" width="80" height="40" as="geometry"/>
        </mxCell>
        <mxCell id="pod1" value="Pod: Frontend-1&#xa;Namespace: production" style="swimlane;fillColor=#d5e8d4;strokeColor=#82b366;" vertex="1" parent="node1">
          <geometry x="20" y="90" width="300" height="120" as="geometry"/>
        </mxCell>
        <mxCell id="container1" value="nginx:latest&#xa;Port: 80" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="pod1">
          <geometry x="20" y="40" width="120" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="sidecar1" value="envoy-proxy&#xa;Service Mesh" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;" vertex="1" parent="pod1">
          <geometry x="160" y="40" width="120" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="pod2" value="Pod: Backend-1&#xa;Namespace: production" style="swimlane;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="node1">
          <geometry x="20" y="230" width="300" height="120" as="geometry"/>
        </mxCell>
        <mxCell id="container2" value="api-service:v2.1&#xa;Port: 8080" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="pod2">
          <geometry x="20" y="40" width="120" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="sidecar2" value="envoy-proxy&#xa;Service Mesh" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;" vertex="1" parent="pod2">
          <geometry x="160" y="40" width="120" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="node2" value="Worker Node 2" style="swimlane;fillColor=#e1d5e7;strokeColor=#9673a6;" vertex="1" parent="cluster">
          <geometry x="380" y="210" width="340" height="470" as="geometry"/>
        </mxCell>
        <mxCell id="kubelet2" value="kubelet" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="node2">
          <geometry x="20" y="30" width="80" height="40" as="geometry"/>
        </mxCell>
        <mxCell id="kproxy2" value="kube-proxy" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="node2">
          <geometry x="120" y="30" width="80" height="40" as="geometry"/>
        </mxCell>
        <mxCell id="runtime2" value="containerd" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="node2">
          <geometry x="220" y="30" width="80" height="40" as="geometry"/>
        </mxCell>
        <mxCell id="pod3" value="Pod: Database-1&#xa;Namespace: database" style="swimlane;fillColor=#f8cecc;strokeColor=#b85450;" vertex="1" parent="node2">
          <geometry x="20" y="90" width="300" height="120" as="geometry"/>
        </mxCell>
        <mxCell id="container3" value="postgres:14&#xa;Port: 5432" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="pod3">
          <geometry x="20" y="40" width="120" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="volume1" value="PersistentVolume&#xa;100GB SSD" style="shape=cylinder;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="pod3">
          <geometry x="160" y="30" width="120" height="80" as="geometry"/>
        </mxCell>
        <mxCell id="pod4" value="Pod: Cache-1&#xa;Namespace: cache" style="swimlane;fillColor=#fff2cc;strokeColor=#d6b656;" vertex="1" parent="node2">
          <geometry x="20" y="230" width="300" height="120" as="geometry"/>
        </mxCell>
        <mxCell id="container4" value="redis:6-alpine&#xa;Port: 6379" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="pod4">
          <geometry x="90" y="40" width="120" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="node3" value="Worker Node 3" style="swimlane;fillColor=#e1d5e7;strokeColor=#9673a6;" vertex="1" parent="cluster">
          <geometry x="740" y="210" width="340" height="470" as="geometry"/>
        </mxCell>
        <mxCell id="monitoring" value="Pod: Prometheus&#xa;Namespace: monitoring" style="swimlane;fillColor=#b0e3e6;strokeColor=#0e8088;" vertex="1" parent="node3">
          <geometry x="20" y="90" width="300" height="120" as="geometry"/>
        </mxCell>
        <mxCell id="prometheus" value="prometheus:latest&#xa;Port: 9090" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="monitoring">
          <geometry x="20" y="40" width="120" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="grafana" value="grafana:latest&#xa;Port: 3000" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="monitoring">
          <geometry x="160" y="40" width="120" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="logging" value="Pod: ELK Stack&#xa;Namespace: logging" style="swimlane;fillColor=#fad9d5;strokeColor=#ae4132;" vertex="1" parent="node3">
          <geometry x="20" y="230" width="300" height="220" as="geometry"/>
        </mxCell>
        <mxCell id="elastic" value="elasticsearch:7.15&#xa;Port: 9200" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="logging">
          <geometry x="20" y="40" width="120" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="logstash" value="logstash:7.15&#xa;Port: 5044" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="logging">
          <geometry x="160" y="40" width="120" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="kibana" value="kibana:7.15&#xa;Port: 5601" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="logging">
          <geometry x="90" y="120" width="120" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="edge1" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=2;strokeColor=#FF0000;" edge="1" parent="cluster" source="api" target="kubelet1">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="edge2" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=2;strokeColor=#FF0000;" edge="1" parent="cluster" source="api" target="kubelet2">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="edge3" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=2;strokeColor=#0000FF;dashed=1;" edge="1" parent="cluster" source="etcd" target="api">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="edge4" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=2;" edge="1" parent="cluster" source="ingress-controller" target="pod1">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="edge5" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=2;" edge="1" parent="cluster" source="container1" target="container2">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="edge6" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=2;" edge="1" parent="cluster" source="container2" target="container3">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="edge7" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=2;" edge="1" parent="cluster" source="container2" target="container4">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>',
    'deployed',
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '4 hours',
    'devops',
    'devops'
);

-- Sample 4: Hybrid Cloud Network
INSERT INTO archiflow.diagrams (id, site_id, site_name, title, description, diagram_data, deployment_status, created_at, modified_at, created_by, modified_by)
VALUES (
    'd4e5f678-90ab-cdef-1234-567890123456',
    1,
    'Main Site',
    'Hybrid Cloud Network - On-Prem to Azure',
    'Hybrid network connecting on-premises datacenter to Azure cloud via ExpressRoute',
    '<mxGraphModel dx="1422" dy="754" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1400" pageHeight="850" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="onprem" value="On-Premises Datacenter" style="swimlane;fillColor=#f5f5f5;strokeColor=#666666;fontSize=14;fontStyle=1" vertex="1" parent="1">
          <geometry x="50" y="50" width="600" height="750" as="geometry"/>
        </mxCell>
        <mxCell id="edge-router1" value="Edge Router 1&#xa;192.168.1.1" style="image;html=1;image=img/lib/clip_art/networking/Router_128x128.png" vertex="1" parent="onprem">
          <geometry x="150" y="50" width="80" height="80" as="geometry"/>
        </mxCell>
        <mxCell id="edge-router2" value="Edge Router 2&#xa;192.168.1.2" style="image;html=1;image=img/lib/clip_art/networking/Router_128x128.png" vertex="1" parent="onprem">
          <geometry x="370" y="50" width="80" height="80" as="geometry"/>
        </mxCell>
        <mxCell id="mpls" value="MPLS Circuit&#xa;100 Gbps" style="ellipse;shape=cloud;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;" vertex="1" parent="onprem">
          <geometry x="250" y="150" width="100" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="dc-core" value="Core Network&#xa;192.168.0.0/16" style="swimlane;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="onprem">
          <geometry x="50" y="250" width="500" height="200" as="geometry"/>
        </mxCell>
        <mxCell id="dc-fw1" value="Firewall HA Pair&#xa;192.168.0.1-2" style="image;html=1;image=img/lib/clip_art/networking/Firewall_128x128.png" vertex="1" parent="dc-core">
          <geometry x="210" y="60" width="80" height="80" as="geometry"/>
        </mxCell>
        <mxCell id="server-farm" value="Server Farm" style="swimlane;fillColor=#d5e8d4;strokeColor=#82b366;" vertex="1" parent="onprem">
          <geometry x="50" y="480" width="500" height="250" as="geometry"/>
        </mxCell>
        <mxCell id="vmware" value="VMware vSphere&#xa;Cluster" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;" vertex="1" parent="server-farm">
          <geometry x="50" y="50" width="150" height="80" as="geometry"/>
        </mxCell>
        <mxCell id="san" value="SAN Storage&#xa;500TB" style="shape=cylinder;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="server-farm">
          <geometry x="300" y="40" width="150" height="100" as="geometry"/>
        </mxCell>
        <mxCell id="backup" value="Backup System&#xa;Veeam" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;" vertex="1" parent="server-farm">
          <geometry x="175" y="160" width="150" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="azure" value="Microsoft Azure" style="swimlane;fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=14;fontStyle=1" vertex="1" parent="1">
          <geometry x="750" y="50" width="600" height="750" as="geometry"/>
        </mxCell>
        <mxCell id="expressroute" value="ExpressRoute&#xa;Circuit" style="ellipse;shape=cloud;whiteSpace=wrap;html=1;fillColor=#ffe6cc;strokeColor=#d79b00;" vertex="1" parent="azure">
          <geometry x="50" y="50" width="150" height="80" as="geometry"/>
        </mxCell>
        <mxCell id="azure-vnet" value="Virtual Network (VNet)&#xa;10.0.0.0/8" style="swimlane;fillColor=#e1d5e7;strokeColor=#9673a6;" vertex="1" parent="azure">
          <geometry x="50" y="180" width="500" height="550" as="geometry"/>
        </mxCell>
        <mxCell id="gateway-subnet" value="Gateway Subnet&#xa;10.0.0.0/27" style="swimlane;fillColor=#fff2cc;strokeColor=#d6b656;" vertex="1" parent="azure-vnet">
          <geometry x="20" y="40" width="460" height="100" as="geometry"/>
        </mxCell>
        <mxCell id="vnet-gw" value="VNet Gateway&#xa;VPN/ExpressRoute" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;" vertex="1" parent="gateway-subnet">
          <geometry x="180" y="30" width="100" height="50" as="geometry"/>
        </mxCell>
        <mxCell id="app-subnet" value="Application Subnet&#xa;10.1.0.0/24" style="swimlane;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="azure-vnet">
          <geometry x="20" y="160" width="460" height="150" as="geometry"/>
        </mxCell>
        <mxCell id="vm1" value="Azure VM&#xa;Web Tier" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="app-subnet">
          <geometry x="30" y="45" width="80" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="vm2" value="Azure VM&#xa;App Tier" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="app-subnet">
          <geometry x="140" y="45" width="80" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="vm3" value="Azure VM&#xa;API Gateway" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="app-subnet">
          <geometry x="250" y="45" width="80" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="container" value="AKS Cluster" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#b0e3e6;strokeColor=#0e8088;" vertex="1" parent="app-subnet">
          <geometry x="360" y="45" width="80" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="data-subnet" value="Data Subnet&#xa;10.2.0.0/24" style="swimlane;fillColor=#f8cecc;strokeColor=#b85450;" vertex="1" parent="azure-vnet">
          <geometry x="20" y="330" width="460" height="200" as="geometry"/>
        </mxCell>
        <mxCell id="sql-mi" value="SQL Managed&#xa;Instance" style="shape=cylinder;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;" vertex="1" parent="data-subnet">
          <geometry x="60" y="60" width="100" height="80" as="geometry"/>
        </mxCell>
        <mxCell id="cosmos" value="Cosmos DB&#xa;NoSQL" style="shape=cylinder;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="data-subnet">
          <geometry x="180" y="60" width="100" height="80" as="geometry"/>
        </mxCell>
        <mxCell id="storage" value="Blob Storage&#xa;Data Lake" style="shape=cylinder;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;" vertex="1" parent="data-subnet">
          <geometry x="300" y="60" width="100" height="80" as="geometry"/>
        </mxCell>
        <mxCell id="internet" value="Internet" style="ellipse;shape=cloud;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;" vertex="1" parent="1">
          <geometry x="600" y="10" width="150" height="80" as="geometry"/>
        </mxCell>
        <mxCell id="edge1" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=3;strokeColor=#FF0000;" edge="1" parent="1" source="edge-router1" target="mpls">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="edge2" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=3;strokeColor=#FF0000;" edge="1" parent="1" source="edge-router2" target="mpls">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="edge3" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=4;strokeColor=#00FF00;" edge="1" parent="1" source="mpls" target="expressroute">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="edge4" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=3;strokeColor=#0000FF;" edge="1" parent="1" source="expressroute" target="vnet-gw">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="edge5" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=2;dashed=1;" edge="1" parent="1" source="dc-fw1" target="vnet-gw">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="label1" value="Site-to-Site VPN&#xa;Backup Connection" style="text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;" vertex="1" parent="1">
          <geometry x="650" y="400" width="100" height="40" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>',
    'draft',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '6 hours',
    'network_admin',
    'network_admin'
);