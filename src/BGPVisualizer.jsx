import React, { useRef, useEffect, useState } from 'react';

const BGPVisualizer = () => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const [autonomousSystems, setAutonomousSystems] = useState([]);
  const [links, setLinks] = useState([]);
  const [packets, setPackets] = useState([]);
  const [selectedAS, setSelectedAS] = useState(null);
  const [routingTables, setRoutingTables] = useState({});
  const [highlightedRoute, setHighlightedRoute] = useState([]);
  const [disabledLinks, setDisabledLinks] = useState(new Set());
  const [simulationStep, setSimulationStep] = useState(0);
  const [simulationSteps, setSimulationSteps] = useState([]);
  const [isSimulationReady, setIsSimulationReady] = useState(false);
  const [draggingAS, setDraggingAS] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [creatingLink, setCreatingLink] = useState(null);
  const [editingAS, setEditingAS] = useState(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 180;

    const asNodes = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI * 2) / 6 - Math.PI / 2;
      asNodes.push({
        id: i + 1,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        radius: 40,
        label: `AS${i + 1}`,
        ipAddress: `10.${i + 1}.0.0/16`,
        neighbors: []
      });
    }

    const linkConnections = [
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0],
      [0, 3], [1, 4], [2, 5]
    ];

    const networkLinks = linkConnections.map(([a, b]) => ({
      from: a,
      to: b,
      id: `${a}-${b}`
    }));

    linkConnections.forEach(([a, b]) => {
      asNodes[a].neighbors.push(b + 1);
      asNodes[b].neighbors.push(a + 1);
    });

    setAutonomousSystems(asNodes);
    setLinks(networkLinks);

    const tables = {};
    asNodes.forEach(as => {
      tables[as.id] = [];
    });
    setRoutingTables(tables);
  }, []);

  const draw = (ctx, as, links, packets, selectedAS, highlightedRoute, disabledLinks, creatingLink) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    links.forEach(link => {
      const fromAS = as[link.from];
      const toAS = as[link.to];
      const isDisabled = disabledLinks.has(link.id) || disabledLinks.has(`${link.to}-${link.from}`);
      const isHighlighted = highlightedRoute.some((route, i) => 
        i < highlightedRoute.length - 1 && 
        ((route - 1 === link.from && highlightedRoute[i + 1] - 1 === link.to) ||
         (route - 1 === link.to && highlightedRoute[i + 1] - 1 === link.from))
      );

      ctx.beginPath();
      ctx.moveTo(fromAS.x, fromAS.y);
      ctx.lineTo(toAS.x, toAS.y);
      
      if (isDisabled) {
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
      } else if (isHighlighted) {
        ctx.strokeStyle = '#2ecc71';
        ctx.lineWidth = 4;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#2ecc71';
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = selectedAS && (fromAS.id === selectedAS || toAS.id === selectedAS) 
          ? '#7f8c8d' : '#95a5a6';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
      }
      
      ctx.stroke();
      ctx.shadowBlur = 0;
    });

    if (creatingLink) {
      const fromAS = as[creatingLink.from];
      ctx.beginPath();
      ctx.moveTo(fromAS.x, fromAS.y);
      ctx.lineTo(creatingLink.x, creatingLink.y);
      ctx.strokeStyle = '#3498db';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    as.forEach(asNode => {
      const isSelected = asNode.id === selectedAS;
      
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(asNode.x, asNode.y, asNode.radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(52, 152, 219, 0.2)';
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(asNode.x, asNode.y, asNode.radius, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#3498db' : '#34495e';
      ctx.fill();
      ctx.strokeStyle = '#2c3e50';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ecf0f1';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(asNode.label, asNode.x, asNode.y);

      ctx.font = '11px monospace';
      ctx.fillStyle = '#95a5a6';
      ctx.fillText(asNode.ipAddress, asNode.x, asNode.y + asNode.radius + 15);
    });

    packets.forEach(packet => {
      ctx.beginPath();
      ctx.arc(packet.x, packet.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#f39c12';
      ctx.fill();
      ctx.strokeStyle = '#e67e22';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    const animate = () => {
      draw(ctx, autonomousSystems, links, packets, selectedAS, highlightedRoute, disabledLinks, creatingLink);
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [autonomousSystems, links, packets, selectedAS, highlightedRoute, disabledLinks, creatingLink]);

  const generateSimulationSteps = () => {
    const source = 1;
    const destination = 6;

    const steps = [];
    const newTables = {};
    autonomousSystems.forEach(as => {
      newTables[as.id] = [];
    });

    const destinationPrefix = autonomousSystems[destination - 1].ipAddress;
    
    newTables[destination].push({
      destination: destinationPrefix,
      asPath: [destination],
      localPref: 100,
      selected: false
    });

    steps.push({
      type: 'init',
      asId: destination,
      tables: JSON.parse(JSON.stringify(newTables)),
      message: `${autonomousSystems[destination - 1].label} announces prefix ${destinationPrefix}`
    });

    const queue = [{asId: destination, path: [destination]}];
    const visited = new Set([destination]);

    while (queue.length > 0) {
      const {asId, path} = queue.shift();
      const currentAS = autonomousSystems[asId - 1];

      for (const neighborId of currentAS.neighbors) {
        const linkId1 = `${asId - 1}-${neighborId - 1}`;
        const linkId2 = `${neighborId - 1}-${asId - 1}`;
        
        if (disabledLinks.has(linkId1) || disabledLinks.has(linkId2)) {
          continue;
        }

        const fromAS = autonomousSystems[asId - 1];
        const toAS = autonomousSystems[neighborId - 1];
        
        const newPath = [...path, neighborId];
        const localPref = 100 + Math.floor(Math.random() * 50);
        
        if (!newTables[neighborId]) {
          newTables[neighborId] = [];
        }

        newTables[neighborId].push({
          destination: destinationPrefix,
          asPath: newPath.reverse(),
          localPref: localPref,
          selected: false
        });

        steps.push({
          type: 'advertise',
          from: asId,
          to: neighborId,
          fromAS: fromAS,
          toAS: toAS,
          path: [...newPath].reverse(),
          tables: JSON.parse(JSON.stringify(newTables)),
          message: `${fromAS.label} advertises route to ${toAS.label}`
        });

        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push({asId: neighborId, path: newPath.reverse()});
        }
      }
    }

    Object.keys(newTables).forEach(asId => {
      const routes = newTables[asId];
      if (routes.length > 0) {
        let bestRoute = routes[0];
        routes.forEach(route => {
          if (route.localPref > bestRoute.localPref) {
            bestRoute = route;
          } else if (route.localPref === bestRoute.localPref && 
                     route.asPath.length < bestRoute.asPath.length) {
            bestRoute = route;
          }
        });

        routes.forEach(route => {
          route.selected = route === bestRoute;
        });
      }
    });

    steps.push({
      type: 'complete',
      tables: JSON.parse(JSON.stringify(newTables)),
      finalPath: newTables[source].find(r => r.selected)?.asPath || [],
      message: 'Path selection complete'
    });

    setSimulationSteps(steps);
    setSimulationStep(0);
    setIsSimulationReady(true);
    setRoutingTables(newTables);
  };

  const executeNextStep = () => {
    if (simulationStep >= simulationSteps.length) return;

    const step = simulationSteps[simulationStep];

    if (step.type === 'advertise') {
      const packet = {
        x: step.fromAS.x,
        y: step.fromAS.y
      };
      setPackets([packet]);

      setTimeout(() => {
        setPackets([]);
        setRoutingTables(step.tables);
      }, 500);
    } else if (step.type === 'complete') {
      setHighlightedRoute(step.finalPath);
      setRoutingTables(step.tables);
    } else {
      setRoutingTables(step.tables);
    }

    setSimulationStep(simulationStep + 1);
  };

  const resetSimulation = () => {
    setPackets([]);
    setHighlightedRoute([]);
    setSelectedAS(null);
    setSimulationStep(0);
    setSimulationSteps([]);
    setIsSimulationReady(false);
    
    const newTables = {};
    autonomousSystems.forEach(as => {
      newTables[as.id] = [];
    });
    setRoutingTables(newTables);
  };

  const handleCanvasMouseDown = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (e.shiftKey) {
      for (const as of autonomousSystems) {
        const distance = Math.sqrt((x - as.x) ** 2 + (y - as.y) ** 2);
        if (distance <= as.radius) {
          setCreatingLink({ from: autonomousSystems.indexOf(as), x, y });
          return;
        }
      }
    }

    for (const as of autonomousSystems) {
      const distance = Math.sqrt((x - as.x) ** 2 + (y - as.y) ** 2);
      if (distance <= as.radius) {
        if (e.altKey) {
          setEditingAS(as.id);
          setEditName(as.label);
          return;
        }
        setDraggingAS(as.id);
        setDragOffset({ x: x - as.x, y: y - as.y });
        return;
      }
    }

    for (const link of links) {
      const fromAS = autonomousSystems[link.from];
      const toAS = autonomousSystems[link.to];
      
      const distToLine = pointToLineDistance(x, y, fromAS.x, fromAS.y, toAS.x, toAS.y);
      if (distToLine < 10) {
        const linkId = link.id;
        const reverseId = `${link.to}-${link.from}`;
        
        setDisabledLinks(prev => {
          const newSet = new Set(prev);
          if (newSet.has(linkId) || newSet.has(reverseId)) {
            newSet.delete(linkId);
            newSet.delete(reverseId);
          } else {
            newSet.add(linkId);
            newSet.add(reverseId);
          }
          return newSet;
        });
        return;
      }
    }
  };

  const handleCanvasMouseMove = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (draggingAS !== null) {
      setAutonomousSystems(prev => prev.map(as => 
        as.id === draggingAS 
          ? { ...as, x: x - dragOffset.x, y: y - dragOffset.y }
          : as
      ));
    }

    if (creatingLink) {
      setCreatingLink({ ...creatingLink, x, y });
    }
  };

  const handleCanvasMouseUp = (e) => {
    if (creatingLink) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      for (const as of autonomousSystems) {
        const distance = Math.sqrt((x - as.x) ** 2 + (y - as.y) ** 2);
        if (distance <= as.radius) {
          const toIndex = autonomousSystems.indexOf(as);
          if (toIndex !== creatingLink.from) {
            const linkId = `${creatingLink.from}-${toIndex}`;
            const reverseLinkId = `${toIndex}-${creatingLink.from}`;
            
            const linkExists = links.some(l => l.id === linkId || l.id === reverseLinkId);
            
            if (!linkExists) {
              setLinks(prev => [...prev, { from: creatingLink.from, to: toIndex, id: linkId }]);
              
              setAutonomousSystems(prev => prev.map((as, idx) => {
                if (idx === creatingLink.from) {
                  return { ...as, neighbors: [...as.neighbors, toIndex + 1] };
                }
                if (idx === toIndex) {
                  return { ...as, neighbors: [...as.neighbors, creatingLink.from + 1] };
                }
                return as;
              }));
            }
          }
          break;
        }
      }
      setCreatingLink(null);
    }

    setDraggingAS(null);
  };

  const pointToLineDistance = (px, py, x1, y1, x2, y2) => {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleRenameSubmit = () => {
    if (editName.trim()) {
      setAutonomousSystems(prev => prev.map(as => 
        as.id === editingAS ? { ...as, label: editName.trim() } : as
      ));
    }
    setEditingAS(null);
    setEditName('');
  };

  const currentStepMessage = simulationSteps[simulationStep - 1]?.message || 'Prepare simulation';

  return (
    <div className="bgp-visualizer">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .bgp-visualizer {
          font-family: 'Courier New', monospace;
          margin: 0 0;
          padding: 20px;
          background: #2c3e50;
          min-height: 100vh;
          color: #ecf0f1;
        }

        .bgp-header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #34495e;
          padding-bottom: 20px;
        }

        .bgp-header h1 {
          font-size: 2em;
          margin: 0 0 10px 0;
          color: #ecf0f1;
          font-weight: normal;
        }

        .bgp-header p {
          font-size: 0.9em;
          color: #95a5a6;
          margin: 5px 0;
        }

        .bgp-controls {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
          align-items: center;
          flex-wrap: wrap;
        }

        .bgp-button {
          padding: 10px 20px;
          font-size: 14px;
          border: 1px solid #7f8c8d;
          background: #34495e;
          color: #ecf0f1;
          cursor: pointer;
          font-family: 'Courier New', monospace;
          transition: background 0.2s;
        }

        .bgp-button:hover:not(:disabled) {
          background: #4a5f7f;
        }

        .bgp-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .bgp-button-primary {
          background: #27ae60;
          border-color: #229954;
        }

        .bgp-button-primary:hover:not(:disabled) {
          background: #2ecc71;
        }

        .bgp-step-info {
          flex: 1;
          padding: 10px;
          background: #34495e;
          border: 1px solid #7f8c8d;
          font-size: 14px;
          min-width: 200px;
        }

        .bgp-canvas-container {
          background: #34495e;
          border: 1px solid #7f8c8d;
          padding: 20px;
          margin-bottom: 20px;
        }

        .bgp-canvas {
          display: block;
          margin: 0 auto;
          background: #2c3e50;
          cursor: crosshair;
        }

        .bgp-instructions {
          background: #34495e;
          border: 1px solid #7f8c8d;
          padding: 15px;
          margin-bottom: 20px;
          font-size: 13px;
          line-height: 1.6;
        }

        .bgp-instructions ul {
          margin: 10px 0;
          padding-left: 20px;
        }

        .bgp-instructions li {
          margin: 5px 0;
        }

        .bgp-routing-tables {
          background: #34495e;
          border: 1px solid #7f8c8d;
          padding: 20px;
        }

        .bgp-routing-tables h2 {
          margin-top: 0;
          font-size: 1.3em;
          font-weight: normal;
          border-bottom: 1px solid #7f8c8d;
          padding-bottom: 10px;
        }

        .bgp-as-table {
          margin-bottom: 25px;
        }

        .bgp-as-table h3 {
          font-size: 1.1em;
          font-weight: normal;
          margin-bottom: 10px;
          color: #3498db;
        }

        .bgp-table {
          width: 100%;
          border-collapse: collapse;
          background: #2c3e50;
          font-size: 13px;
        }

        .bgp-table th {
          background: #34495e;
          padding: 8px;
          text-align: left;
          border: 1px solid #7f8c8d;
          font-weight: normal;
        }

        .bgp-table td {
          padding: 8px;
          border: 1px solid #7f8c8d;
        }

        .bgp-table-row-selected {
          background: #27ae60;
          color: #ecf0f1;
        }

        .bgp-empty-state {
          text-align: center;
          padding: 20px;
          color: #7f8c8d;
          font-style: italic;
        }

        .bgp-modal {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: #34495e;
          border: 2px solid #7f8c8d;
          padding: 20px;
          z-index: 1000;
        }

        .bgp-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          z-index: 999;
        }

        .bgp-input {
          padding: 8px;
          background: #2c3e50;
          border: 1px solid #7f8c8d;
          color: #ecf0f1;
          font-family: 'Courier New', monospace;
          font-size: 14px;
          width: 200px;
          margin-right: 10px;
        }

        .bgp-explanation {
          background: #34495e;
          border: 1px solid #7f8c8d;
          padding: 20px;
          margin-top: 20px;
          line-height: 1.7;
        }

        .bgp-explanation h2 {
          font-size: 1.4em;
          font-weight: normal;
          border-bottom: 1px solid #7f8c8d;
          padding-bottom: 10px;
          margin-top: 0;
        }

        .bgp-explanation h3 {
          font-size: 1.1em;
          font-weight: normal;
          color: #3498db;
          margin-top: 20px;
          margin-bottom: 10px;
        }

        .bgp-explanation p {
          margin: 10px 0;
          color: #bdc3c7;
        }

        .bgp-explanation ol, .bgp-explanation ul {
          margin: 10px 0;
          padding-left: 25px;
          color: #bdc3c7;
        }

        .bgp-explanation li {
          margin: 8px 0;
        }

        .bgp-explanation strong {
          color: #ecf0f1;
        }
      `}</style>

      <div className="bgp-header">
        <h1>BGP Network Simulator</h1>
        <p>Border Gateway Protocol visualization and step-by-step route propagation</p>
      </div>

      <div className="bgp-instructions">
        <strong>Instructions:</strong>
        <ul>
          <li>Drag AS nodes to reposition them</li>
          <li>Hold Shift and drag from one AS to another to create a link</li>
          <li>Hold Alt and click an AS to rename it</li>
          <li>Click a link to disable/enable it</li>
          <li>Click "Prepare Simulation" to generate the route advertisement sequence</li>
          <li>Click "Next Step" to advance through each route advertisement</li>
        </ul>
      </div>

      <div className="bgp-controls">
        <button 
          className="bgp-button bgp-button-primary" 
          onClick={generateSimulationSteps}
          disabled={isSimulationReady}
        >
          Prepare Simulation
        </button>
        <button 
          className="bgp-button" 
          onClick={executeNextStep}
          disabled={!isSimulationReady || simulationStep >= simulationSteps.length}
        >
          Next Step ({simulationStep}/{simulationSteps.length})
        </button>
        <button 
          className="bgp-button" 
          onClick={resetSimulation}
        >
          Reset
        </button>
        <div className="bgp-step-info">
          {currentStepMessage}
        </div>
      </div>

      <div className="bgp-canvas-container">
        <canvas 
          ref={canvasRef} 
          width={800} 
          height={600}
          className="bgp-canvas"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
        />
      </div>

      {editingAS && (
        <>
          <div className="bgp-modal-overlay" onClick={() => setEditingAS(null)} />
          <div className="bgp-modal">
            <h3>Rename AS</h3>
            <input 
              type="text" 
              className="bgp-input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleRenameSubmit()}
              autoFocus
            />
          
            <button className="bgp-button" onClick={handleRenameSubmit}>OK</button>
            <button className="bgp-button" onClick={() => setEditingAS(null)}>Cancel</button>
          </div>
        </>
      )}

      <div className="bgp-routing-tables">
        <h2>Routing Tables</h2>
        
        {autonomousSystems.length === 0 ? (
          <div className="bgp-empty-state">Loading network topology</div>
        ) : (
          autonomousSystems.map(as => (
            <div key={as.id} className="bgp-as-table">
              <h3>{as.label}</h3>
              {routingTables[as.id]?.length > 0 ? (
                <table className="bgp-table">
                  <thead>
                    <tr>
                      <th>Destination</th>
                      <th>AS Path</th>
                      <th>Local Pref</th>
                      <th>Selected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {routingTables[as.id].map((route, idx) => (
                      <tr key={idx} className={route.selected ? 'bgp-table-row-selected' : ''}>
                        <td>{route.destination}</td>
                        <td>{route.asPath.map(asNum => autonomousSystems[asNum - 1]?.label || `AS${asNum}`).join(' -> ')}</td>
                        <td>{route.localPref}</td>
                        <td>{route.selected ? 'yes' : 'no'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="bgp-empty-state">No routes</div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="bgp-explanation">
        <h2>How BGP Works</h2>
        
        <h3>What is an Autonomous System (AS)?</h3>
        <p>
          An Autonomous System is a collection of IP networks and routers under the control of a single organization 
          that presents a common routing policy to the internet. Each AS is identified by a unique AS number (ASN). 
          In this simulation, each node represents an AS with its own network prefix.
        </p>

        <h3>Border Gateway Protocol (BGP)</h3>
        <p>
          BGP is the protocol used to exchange routing information between autonomous systems on the internet. 
          It is a path vector protocol that makes routing decisions based on paths, network policies, and rule sets.
        </p>
        <p>
          When an AS wants to announce that it can reach a particular network prefix, it sends BGP advertisements 
          to its neighboring ASes. These neighbors then propagate the route information to their neighbors, and so on. 
          Each AS that forwards the advertisement adds its own AS number to the path.
        </p>

        <h3>BGP Path Selection</h3>
        <p>
          When an AS receives multiple routes to the same destination, it must select the best path. 
          BGP uses the following criteria in order:
        </p>
        <ol>
          <li><strong>Local Preference:</strong> Higher values are preferred. This is an internal metric that allows 
          network administrators to prefer certain paths over others within their AS.</li>
          <li><strong>AS Path Length:</strong> Shorter paths are preferred. The path with fewer AS hops is typically faster.</li>
          <li>Additional tie-breakers like origin type, MED, and router ID (not implemented in this simulation).</li>
        </ol>

        <h3>What is Local Preference?</h3>
        <p>
          Local Preference (Local Pref) is a BGP attribute used within an AS to influence outbound traffic routing. 
          It is a numerical value where higher numbers indicate more preferred routes. This value is only significant 
          within a single AS and is not propagated to other autonomous systems. Network operators use local preference 
          to implement routing policies, such as preferring traffic through one ISP over another.
        </p>

        <h3>How This Simulation Works</h3>
        <ol>
          <li>The destination AS (AS6 by default) originates a route announcement for its network prefix (10.6.0.0/16).</li>
          <li>The route advertisement propagates hop-by-hop through the network topology along active links.</li>
          <li>Each AS that receives the advertisement adds itself to the AS path and forwards it to its neighbors.</li>
          <li>ASes may receive multiple route advertisements for the same destination through different paths.</li>
          <li>Each AS stores all received routes in its routing table with associated attributes (AS path, local preference).</li>
          <li>After receiving all advertisements, each AS applies BGP path selection criteria to choose the best route.</li>
          <li>The selected route is marked in the routing table and used for forwarding traffic to that destination.</li>
        </ol>
        <p>
          In this simulation, local preference values are randomly assigned to demonstrate how they affect path selection. 
          In production networks, these values are carefully configured based on business relationships and traffic engineering requirements.
        </p>
      </div>
    </div>
  );
};

export default BGPVisualizer;