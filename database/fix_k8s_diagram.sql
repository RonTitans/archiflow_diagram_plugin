-- Update Kubernetes Production Cluster diagram
UPDATE archiflow.diagrams
SET diagram_data = '<mxfile host="app.diagrams.net" agent="Network Diagram Tool" version="24.7.17">
  <diagram id="k8s-production" name="Kubernetes Cluster">
    <mxGraphModel dx="1422" dy="754" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="cluster" value="Kubernetes Production Cluster" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#E6F7FF;strokeColor=#0050EF;verticalAlign=top;fontStyle=1;fontSize=16;" vertex="1" parent="1">
          <mxGeometry x="50" y="50" width="1000" height="700" as="geometry"/>
        </mxCell>
        <mxCell id="masters" value="Control Plane (Masters)" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFE6CC;strokeColor=#D79B00;verticalAlign=top;fontStyle=1;" vertex="1" parent="1">
          <mxGeometry x="100" y="100" width="900" height="150" as="geometry"/>
        </mxCell>
        <mxCell id="master1" value="Master-1&#xa;etcd&#xa;API Server&#xa;Controller&#xa;Scheduler" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#DAE8FC;strokeColor=#6C8EBF;" vertex="1" parent="1">
          <mxGeometry x="150" y="140" width="100" height="80" as="geometry"/>
        </mxCell>
        <mxCell id="master2" value="Master-2&#xa;etcd&#xa;API Server&#xa;Controller&#xa;Scheduler" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#DAE8FC;strokeColor=#6C8EBF;" vertex="1" parent="1">
          <mxGeometry x="450" y="140" width="100" height="80" as="geometry"/>
        </mxCell>
        <mxCell id="master3" value="Master-3&#xa;etcd&#xa;API Server&#xa;Controller&#xa;Scheduler" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#DAE8FC;strokeColor=#6C8EBF;" vertex="1" parent="1">
          <mxGeometry x="750" y="140" width="100" height="80" as="geometry"/>
        </mxCell>
        <mxCell id="workers" value="Worker Nodes" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#E1D5E7;strokeColor=#9673A6;verticalAlign=top;fontStyle=1;" vertex="1" parent="1">
          <mxGeometry x="100" y="280" width="900" height="200" as="geometry"/>
        </mxCell>
        <mxCell id="worker1" value="Worker-1&#xa;16 CPU&#xa;64GB RAM" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#FFF2CC;strokeColor=#D6B656;" vertex="1" parent="1">
          <mxGeometry x="130" y="330" width="80" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="worker2" value="Worker-2&#xa;16 CPU&#xa;64GB RAM" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#FFF2CC;strokeColor=#D6B656;" vertex="1" parent="1">
          <mxGeometry x="250" y="330" width="80" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="worker3" value="Worker-3&#xa;16 CPU&#xa;64GB RAM" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#FFF2CC;strokeColor=#D6B656;" vertex="1" parent="1">
          <mxGeometry x="370" y="330" width="80" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="ingress" value="Ingress Controller&#xa;NGINX" style="shape=hexagon;perimeter=hexagonPerimeter2;whiteSpace=wrap;html=1;fixedSize=1;fillColor=#FFD9E1;strokeColor=#FF6B9D;" vertex="1" parent="1">
          <mxGeometry x="750" y="340" width="120" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="services" value="Services and Networking" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#F0F0F0;strokeColor=#666666;verticalAlign=top;fontStyle=1;" vertex="1" parent="1">
          <mxGeometry x="100" y="510" width="400" height="120" as="geometry"/>
        </mxCell>
        <mxCell id="svc1" value="Service:&#xa;LoadBalancer" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#B3E5FC;" vertex="1" parent="1">
          <mxGeometry x="120" y="550" width="80" height="40" as="geometry"/>
        </mxCell>
        <mxCell id="storage" value="Storage Classes" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#F0F0F0;strokeColor=#666666;verticalAlign=top;fontStyle=1;" vertex="1" parent="1">
          <mxGeometry x="550" y="510" width="200" height="120" as="geometry"/>
        </mxCell>
        <mxCell id="pv1" value="PV: SSD&#xa;100Gi" style="shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15;fillColor=#FFE082;" vertex="1" parent="1">
          <mxGeometry x="570" y="550" width="60" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="monitoring" value="Monitoring Stack" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#F0F0F0;strokeColor=#666666;verticalAlign=top;fontStyle=1;" vertex="1" parent="1">
          <mxGeometry x="800" y="510" width="200" height="120" as="geometry"/>
        </mxCell>
        <mxCell id="prom" value="Prometheus" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#C8E6C9;" vertex="1" parent="1">
          <mxGeometry x="820" y="550" width="70" height="30" as="geometry"/>
        </mxCell>
        <mxCell id="graf" value="Grafana" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#C8E6C9;" vertex="1" parent="1">
          <mxGeometry x="910" y="550" width="70" height="30" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>'
WHERE title = 'Kubernetes Production Cluster';