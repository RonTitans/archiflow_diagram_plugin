-- Update Hybrid Cloud Network diagram
UPDATE archiflow.diagrams
SET diagram_data = '<mxfile host="app.diagrams.net" agent="Network Diagram Tool" version="24.7.17">
  <diagram id="hybrid-cloud" name="Hybrid Cloud Network">
    <mxGraphModel dx="1422" dy="754" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="onprem" value="On-Premises Data Center" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#F0F0F0;strokeColor=#666666;verticalAlign=top;fontStyle=1;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="50" y="50" width="450" height="400" as="geometry"/>
        </mxCell>
        <mxCell id="corpnet" value="Corporate Network&#xa;10.0.0.0/8" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#E6F2FF;strokeColor=#4D9EF8;" vertex="1" parent="1">
          <mxGeometry x="70" y="100" width="410" height="80" as="geometry"/>
        </mxCell>
        <mxCell id="corerouter" value="Core Router&#xa;10.0.0.1" style="shape=image;verticalLabelPosition=bottom;labelBackgroundColor=#ffffff;verticalAlign=top;aspect=fixed;imageAspect=0;image=data:image/svg+xml,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI+PGRlZnM+PHN0eWxlPi5jbHMtMXtmaWxsOiMzMzMzMzM7fTwvc3R5bGU+PC9kZWZzPjxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTQ0LDE4SDRhMiwyLDAsMCwwLTIsMnY4YTIsMiwwLDAsMCwyLDJINDRhMiwyLDAsMCwwLDItMlYyMEEyLDIsMCwwLDAsNDQsMThaTTEwLDI2YTIsMiwwLDEsMSwyLTJBMiwyLDAsMCwxLDEwLDI2WiIvPjwvc3ZnPg==;" vertex="1" parent="1">
          <mxGeometry x="235" y="110" width="80" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="dmz" value="DMZ" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#FFE6CC;strokeColor=#D79B00;" vertex="1" parent="1">
          <mxGeometry x="90" y="200" width="150" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="internal" value="Internal Network" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#D5E8D4;strokeColor=#82B366;" vertex="1" parent="1">
          <mxGeometry x="310" y="200" width="150" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="servers" value="Server Farm" style="shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15;fillColor=#FFF2CC;strokeColor=#D6B656;" vertex="1" parent="1">
          <mxGeometry x="345" y="280" width="80" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="expressroute" value="Azure ExpressRoute&#xa;100 Gbps" style="shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1;fillColor=#FF9900;fontColor=#ffffff;fontStyle=1;" vertex="1" parent="1">
          <mxGeometry x="200" y="380" width="150" height="50" as="geometry"/>
        </mxCell>
        <mxCell id="azure" value="Microsoft Azure" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#0078D4;fontColor=#ffffff;verticalAlign=top;fontStyle=1;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="600" y="50" width="500" height="400" as="geometry"/>
        </mxCell>
        <mxCell id="hubvnet" value="Hub VNet&#xa;172.16.0.0/16" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#E6F2FF;strokeColor=#4D9EF8;verticalAlign=top;" vertex="1" parent="1">
          <mxGeometry x="620" y="100" width="200" height="150" as="geometry"/>
        </mxCell>
        <mxCell id="azfw" value="Azure Firewall" style="shape=image;verticalLabelPosition=bottom;labelBackgroundColor=#ffffff;verticalAlign=top;aspect=fixed;imageAspect=0;image=data:image/svg+xml,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI+PGRlZnM+PHN0eWxlPi5jbHMtMXtmaWxsOiNmZjRhNGE7fTwvc3R5bGU+PC9kZWZzPjxyZWN0IGNsYXNzPSJjbHMtMSIgeD0iMTgiIHk9IjgiIHdpZHRoPSIxMiIgaGVpZ2h0PSIzMiIvPjwvc3ZnPg==;" vertex="1" parent="1">
          <mxGeometry x="680" y="140" width="80" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="spoke1" value="Spoke VNet 1&#xa;172.17.0.0/16&#xa;Production" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFE6CC;strokeColor=#D79B00;" vertex="1" parent="1">
          <mxGeometry x="850" y="100" width="120" height="80" as="geometry"/>
        </mxCell>
        <mxCell id="spoke2" value="Spoke VNet 2&#xa;172.18.0.0/16&#xa;Development" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#D5E8D4;strokeColor=#82B366;" vertex="1" parent="1">
          <mxGeometry x="850" y="200" width="120" height="80" as="geometry"/>
        </mxCell>
        <mxCell id="vm1" value="VM: Web Server" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#DAE8FC;strokeColor=#6C8EBF;" vertex="1" parent="1">
          <mxGeometry x="870" y="130" width="80" height="40" as="geometry"/>
        </mxCell>
        <mxCell id="vm2" value="VM: App Server" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#DAE8FC;strokeColor=#6C8EBF;" vertex="1" parent="1">
          <mxGeometry x="870" y="230" width="80" height="40" as="geometry"/>
        </mxCell>
        <mxCell id="azuresql" value="Azure SQL&#xa;Database" style="shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15;fillColor=#E1D5E7;strokeColor=#9673A6;" vertex="1" parent="1">
          <mxGeometry x="990" y="140" width="80" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="storage" value="Blob Storage" style="shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15;fillColor=#A9CCE3;" vertex="1" parent="1">
          <mxGeometry x="990" y="220" width="80" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="vpngateway" value="VPN Gateway&#xa;Backup Connection" style="shape=hexagon;perimeter=hexagonPerimeter2;whiteSpace=wrap;html=1;fixedSize=1;fillColor=#FFD9E1;strokeColor=#FF6B9D;" vertex="1" parent="1">
          <mxGeometry x="680" y="350" width="120" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="internet" value="Internet" style="ellipse;shape=cloud;whiteSpace=wrap;html=1;fillColor=#76D7C4;" vertex="1" parent="1">
          <mxGeometry x="470" y="500" width="120" height="80" as="geometry"/>
        </mxCell>
        <mxCell id="edge1" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=3;strokeColor=#FF9900;" edge="1" parent="1" source="corerouter" target="expressroute">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="edge2" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=3;strokeColor=#FF9900;" edge="1" parent="1" source="expressroute" target="azfw">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="edge3" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=2;dashed=1;" edge="1" parent="1" source="vpngateway" target="corerouter">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>'
WHERE title = 'Hybrid Cloud Network - On-Prem to Azure';