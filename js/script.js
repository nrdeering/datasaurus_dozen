// LAYOUT AND SIZING
const margin = { top: 10, right: 20, bottom: 30, left: 40 };
const width  = 400 - margin.left - margin.right;
const height = 400 - margin.top - margin.bottom;
const gap = 20;
const histHeight = 220;
const innerCombined = width * 2 + gap;

// ASSIGN VARIABLES FOR DATA INTERACTION
let selectedId = null;  
let selectedSeries = null;

// Current bins for dot-click updates on histogram
let curD1 = [], curD2 = [];
let curB1x = [], curB2x = [];

// Call render to empty callback, gets overwrittenon updates
let renderStyles = () => {};

// FORMAT VARIABLES
const fmt2 = d3.format(".2f");
const fmt3 = d3.format(".3f");

// ------------------------------
// HELPERS
// ------------------------------
function createSVG(container, vbWidth, vbHeight) {

  return d3.select(container).append("svg")
    .attr("viewBox", `0 0 ${vbWidth + margin.left + margin.right} ${vbHeight + margin.top + margin.bottom}`)
    .attr("width",  vbWidth  + margin.left + margin.right)
    .attr("height", vbHeight + margin.top  + margin.bottom)
    .style("max-width","100%")
    .style("height","auto")
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);
}

// Create points for line of best fit on each category
function linearRegression(points) {
  const n = points.length || 0;
  if (n < 2) return { m: 0, b: 0, r2: 0 };
  let sumX=0,sumY=0,sumXY=0,sumXX=0,sumYY=0;
  for (const p of points){const X=+p.x,Y=+p.y;sumX+=X;sumY+=Y;sumXY+=X*Y;sumXX+=X*X;sumYY+=Y*Y;}
  const xBar=sumX/n,yBar=sumY/n;
  const covXY=sumXY-n*xBar*yBar;
  const varX =sumXX-n*xBar*xBar;
  const varY =sumYY-n*yBar*yBar;
  const m = varX===0?0:(covXY/varX);
  const b = yBar - m*xBar;
  const r2 = (varX===0||varY===0)?0:(covXY*covXY)/(varX*varY);
  return { m,b,r2 };
}

// Convert points to a single line
function lineFromFit({ m, b }, xDomain) {
  const [x0,x1] = xDomain;
  return [{x:x0,y:m*x0+b},{x:x1,y:m*x1+b}];
}

// Determines whether a value falls in a given histogram bin
function binContains(bin, xVal, isLast) {
  if (xVal == null) return false;
  return isLast ? (xVal >= bin.x0 && xVal <= bin.x1)
                : (xVal >= bin.x0 && xVal <  bin.x1);
}

// Update data cards 
function updateCards(d1, d2, fit1, fit2){
  const requiredIds = [
    'card1-meanx','card1-medianx','card1-meany','card1-mediany','card1-r2',
    'card2-meanx','card2-medianx','card2-meany','card2-mediany','card2-r2'
  ];

  if (requiredIds.some(id => !document.getElementById(id))) return;

  const meanX1   = d3.mean(d1, d => d.x);
  const medianX1 = d3.median(d1, d => d.x);
  const meanY1   = d3.mean(d1, d => d.y);
  const medianY1 = d3.median(d1, d => d.y);

  d3.select("#card1-meanx").text(fmt2(meanX1 ?? 0));
  d3.select("#card1-medianx").text(fmt2(medianX1 ?? 0));
  d3.select("#card1-meany").text(fmt2(meanY1 ?? 0));
  d3.select("#card1-mediany").text(fmt2(medianY1 ?? 0));
  d3.select("#card1-r2").text(fmt3(fit1?.r2 ?? 0));

  const meanX2   = d3.mean(d2, d => d.x);
  const medianX2 = d3.median(d2, d => d.x);
  const meanY2   = d3.mean(d2, d => d.y);
  const medianY2 = d3.median(d2, d => d.y);

  d3.select("#card2-meanx").text(fmt2(meanX2 ?? 0));
  d3.select("#card2-medianx").text(fmt2(medianX2 ?? 0));
  d3.select("#card2-meany").text(fmt2(meanY2 ?? 0));
  d3.select("#card2-mediany").text(fmt2(medianY2 ?? 0));
  d3.select("#card2-r2").text(fmt3(fit2?.r2 ?? 0));
}

// TOOLTIP ATTRIBUTES
const tooltip = d3.select("body").append("div")
  .attr("class","tooltip")
  .style("position","absolute")
  .style("background","rgba(0,0,0,0.85)")
  .style("color","#e5e7eb")
  .style("padding","6px 10px")
  .style("border-radius","6px")
  .style("font-size","13px")
  .style("line-height","1.2")
  .style("pointer-events","none")
  .style("opacity",0)
  .style("z-index",10);

const showTip = (html, evt) => tooltip.html(html)
  .style("left",(evt.pageX+12)+"px")
  .style("top",(evt.pageY-24)+"px")
  .style("opacity",1);
const moveTip = (evt) => tooltip
  .style("left",(evt.pageX+12)+"px")
  .style("top",(evt.pageY-24)+"px");
const hideTip = () => tooltip.style("opacity",0);

// SVGs
const svg1 = createSVG("#chart1", width, height);
const svg2 = createSVG("#chart2", width, height);

// click empty space to clear selections
svg1.append("rect").attr("x",0).attr("y",0).attr("width",width).attr("height",height)
  .attr("fill","transparent")
  .on("click",()=>{selectedId=null;selectedSeries=null;renderStyles();});
svg2.append("rect").attr("x",0).attr("y",0).attr("width",width).attr("height",height)
  .attr("fill","transparent")
  .on("click",()=>{selectedId=null;selectedSeries=null;renderStyles();});

// layers
const dots1 = svg1.append("g");
const dots2 = svg2.append("g");
const trend1G = svg1.append("g");
const trend2G = svg2.append("g");

// Density charts (separate)
const densityChart1 = createSVG("#density1", width, height);
const densityChart2 = createSVG("#density2", width, height);

// Histogram
const histXSvg = createSVG("#histX", innerCombined, histHeight);
const barsX1 = histXSvg.append("g");
const barsX2 = histXSvg.append("g");
const yAxisXG = histXSvg.append("g").attr("class","axis");
const xAxisXG = histXSvg.append("g").attr("class","axis").attr("transform",`translate(0,${histHeight})`);

// DATA
d3.csv("data/datasaurus_dozen.csv", d => ({ dataset:d.dataset, x:+d.x, y:+d.y }))
.then(data => {
  // dropdowns
  const cats = Array.from(new Set(data.map(d=>d.dataset))).sort();
  d3.select("#cat1").selectAll("option").data(cats).enter().append("option")
    .attr("value",d=>d).text(d=>d);
  d3.select("#cat2").selectAll("option").data(cats).enter().append("option")
    .attr("value",d=>d).text(d=>d);
  d3.select("#cat1").property("value", cats[0]);
  d3.select("#cat2").property("value", cats[1] ?? cats[0]);

  const x = d3.scaleLinear().domain(d3.extent(data,d=>d.x)).nice().range([0,width]);
  const y = d3.scaleLinear().domain(d3.extent(data,d=>d.y)).nice().range([height,0]);

  // axes
  svg1.append("g").attr("transform",`translate(0,${height})`).call(d3.axisBottom(x));
  svg1.append("g").call(d3.axisLeft(y));
  svg2.append("g").attr("transform",`translate(0,${height})`).call(d3.axisBottom(x));
  svg2.append("g").call(d3.axisLeft(y));
  densityChart1.append("g").attr("transform",`translate(0,${height})`).call(d3.axisBottom(x));
  densityChart1.append("g").call(d3.axisLeft(y));
  densityChart2.append("g").attr("transform",`translate(0,${height})`).call(d3.axisBottom(x));
  densityChart2.append("g").call(d3.axisLeft(y));

  // histogram helpers
  const xExtent  = d3.extent(data,d=>d.x);
  const thresholdsX = d3.ticks(xExtent[0], xExtent[1], 20);
  const binnerX = d3.bin().domain(xExtent).thresholds(thresholdsX).value(d=>d.x);
  const xScaleX = d3.scaleLinear().domain(xExtent).range([0, innerCombined]);
  const yCountX = d3.scaleLinear().range([histHeight,0]).nice();
  const barWidth = (b)=>Math.max(1, xScaleX(b.x1)-xScaleX(b.x0));

  // generators
  const lineGen = d3.line().x(d=>x(d.x)).y(d=>y(d.y));
  const densityGen = d3.contourDensity()
    .x(d=>x(d.x))
    .y(d=>y(d.y))
    .size([width,height])
    .bandwidth(20)
    .thresholds(15);

  // update based on content interaction
  renderStyles = function () {
    const hasPoint = selectedId !== null;
    const hasSeries = !!selectedSeries;

    // dots
    svg1.selectAll("circle.dot1")
      .attr("opacity", d => hasPoint ? (d.id===selectedId?1:0.15)
                          : hasSeries ? (selectedSeries==='c1'?1:0.15) : 1)
      .attr("r", d => d.id===selectedId?6:4)
      .attr("stroke", d => d.id===selectedId?"#fff":"none")
      .attr("stroke-width", d => d.id===selectedId?1.5:0);

    svg2.selectAll("circle.dot2")
      .attr("opacity", d => hasPoint ? (d.id===selectedId?1:0.15)
                          : hasSeries ? (selectedSeries==='c2'?1:0.15) : 1)
      .attr("r", d => d.id===selectedId?6:4)
      .attr("stroke", d => d.id===selectedId?"#000":"none")
      .attr("stroke-width", d => d.id===selectedId?1.5:0);

    // trendlines
    trend1G.selectAll("path.trendline")
      .attr("stroke-opacity", hasPoint ? 0.25 : hasSeries ? (selectedSeries==='c1'?0.95:0.15) : 0.9)
      .attr("stroke-width", hasSeries && selectedSeries==='c1' ? 3 : 2);
    trend2G.selectAll("path.trendline")
      .attr("stroke-opacity", hasPoint ? 0.25 : hasSeries ? (selectedSeries==='c2'?0.95:0.15) : 0.9)
      .attr("stroke-width", hasSeries && selectedSeries==='c2' ? 3 : 2);

    // histogram bars
    if (hasPoint) {
      const sel = [...curD1, ...curD2].find(d => d.id === selectedId);
      const selX = sel ? sel.x : null;
      curB1x.forEach((b,i)=> b.__isLast = (i === curB1x.length - 1));
      curB2x.forEach((b,i)=> b.__isLast = (i === curB2x.length - 1));

      barsX1.selectAll("rect")
        .attr("fill-opacity", b => binContains(b, selX, b.__isLast) ? 0.9 : 0.12)
        .attr("stroke-opacity", b => binContains(b, selX, b.__isLast) ? 1.0 : 0.15);

      barsX2.selectAll("rect")
        .attr("fill-opacity", b => binContains(b, selX, b.__isLast) ? 0.9 : 0.12)
        .attr("stroke-opacity", b => binContains(b, selX, b.__isLast) ? 1.0 : 0.15);
    } else if (hasSeries) {
      barsX1.selectAll("rect")
        .attr("fill-opacity", selectedSeries==='c1'?0.75:0.15)
        .attr("stroke-opacity", selectedSeries==='c1'?1.00:0.15);
      barsX2.selectAll("rect")
        .attr("fill-opacity", selectedSeries==='c2'?0.75:0.15)
        .attr("stroke-opacity", selectedSeries==='c2'?1.00:0.15);
    } else {
      barsX1.selectAll("rect").attr("fill-opacity", 0.45).attr("stroke-opacity", 0.6);
      barsX2.selectAll("rect").attr("fill-opacity", 0.45).attr("stroke-opacity", 0.6);
    }

    // cards by series
    d3.select("#data-cards1").style("opacity", hasSeries ? (selectedSeries==='c1'?1:0.35) : 1);
    d3.select("#data-cards2").style("opacity", hasSeries ? (selectedSeries==='c2'?1:0.35) : 1);
  };

  // draw separate contour density charts
  function renderDensityCharts(d1, d2, c1, c2) {
    const c1Contours = densityGen(d1);
    const c2Contours = densityGen(d2);

    const draw = (svg, contours, color, label) => {
      svg.selectAll("path.density")
        .data(contours, d=>d.value)
        .join(
          enter => enter.append("path").attr("class","density")
            .attr("d", d3.geoPath())
            .attr("fill", color)
            .attr("fill-opacity", 0.25)
            .attr("stroke", color)
            .attr("stroke-opacity", 0.5)
            .on("mouseover",(evt, d)=> showTip(`<strong>${label}</strong><br>Density: ${fmt3(d.value)}`, evt))
            .on("mousemove", moveTip)
            .on("mouseout", hideTip),
          update => update.attr("d", d3.geoPath()),
          exit => exit.remove()
        );
    };

    draw(densityChart1, c1Contours, "#60a5fa", c1);
    draw(densityChart2, c2Contours, "#f5ed0bff", c2);
  }

  // Function to update all charts on category selections
  function update() {
    const c1 = d3.select("#cat1").property("value");
    const c2 = d3.select("#cat2").property("value");
    d3.select("#title1").text(c1);
    d3.select("#title2").text(c2);

    const d1 = data.filter(d=>d.dataset===c1);
    const d2 = data.filter(d=>d.dataset===c2);

    // stable ids per subset render
    d1.forEach((d,i)=> d.id = `c1-${i}`);
    d2.forEach((d,i)=> d.id = `c2-${i}`);

    curD1 = d1;
    curD2 = d2;

    // dots
    dots1.selectAll("circle.dot1").data(d1, d=>d.id)
      .join(enter => enter.append("circle")
        .attr("class","dot1")
        .attr("cx", d=>x(d.x))
        .attr("cy", d=>y(d.y))
        .attr("r", 4)
        .attr("fill", "#60a5fa")
        .style("cursor","pointer")
        .on("mouseover",(evt,d)=> showTip(`<strong>${c1}</strong><br>x: ${fmt2(d.x)}<br>y: ${fmt2(d.y)}`, evt))
        .on("mousemove", moveTip)
        .on("mouseout", hideTip)
        .on("click",(evt,d)=>{evt.stopPropagation(); selectedId=(selectedId===d.id)?null:d.id; selectedSeries=null; renderStyles();}),
        updateSel => updateSel.attr("cx", d=>x(d.x)).attr("cy", d=>y(d.y)),
        exit => exit.remove()
      );

    dots2.selectAll("circle.dot2").data(d2, d=>d.id)
      .join(enter => enter.append("circle")
        .attr("class","dot2")
        .attr("cx", d=>x(d.x))
        .attr("cy", d=>y(d.y))
        .attr("r", 4)
        .attr("fill", "#f5ed0bff")
        .style("cursor","pointer")
        .on("mouseover",(evt,d)=> showTip(`<strong>${c2}</strong><br>x: ${fmt2(d.x)}<br>y: ${fmt2(d.y)}`, evt))
        .on("mousemove", moveTip)
        .on("mouseout", hideTip)
        .on("click",(evt,d)=>{evt.stopPropagation(); selectedId=(selectedId===d.id)?null:d.id; selectedSeries=null; renderStyles();}),
        updateSel => updateSel.attr("cx", d=>x(d.x)).attr("cy", d=>y(d.y)),
        exit => exit.remove()
      );

    // trendlines
    const fit1 = linearRegression(d1);
    const fit2 = linearRegression(d2);
    const line1Pts = lineFromFit(fit1, x.domain());
    const line2Pts = lineFromFit(fit2, x.domain());

    trend1G.selectAll("path.trendline").data([line1Pts])
      .join("path")
      .attr("class","trendline")
      .attr("d", lineGen)
      .attr("fill","none")
      .attr("stroke","#60a5fa")
      .attr("stroke-width",2)
      .style("pointer-events","all")
      .on("mouseover",(evt)=> {
        const eq=`y = ${fmt3(fit1.m)}x + ${fmt3(fit1.b)}`;
        showTip(`<strong>${c1}</strong><br>${eq}<br>R² = ${fmt3(fit1.r2)}`, evt);
      })
      .on("mousemove", moveTip)
      .on("mouseout", hideTip)
      .on("click",(evt)=>{evt.stopPropagation(); selectedId=null; selectedSeries=(selectedSeries==='c1')?null:'c1'; renderStyles();});

    trend2G.selectAll("path.trendline").data([line2Pts])
      .join("path")
      .attr("class","trendline")
      .attr("d", lineGen)
      .attr("fill","none")
      .attr("stroke","#f5ed0bff")
      .attr("stroke-width",2)
      .style("pointer-events","all")
      .on("mouseover",(evt)=> {
        const eq=`y = ${fmt3(fit2.m)}x + ${fmt3(fit2.b)}`;
        showTip(`<strong>${c2}</strong><br>${eq}<br>R² = ${fmt3(fit2.r2)}`, evt);
      })
      .on("mousemove", moveTip)
      .on("mouseout", hideTip)
      .on("click",(evt)=>{evt.stopPropagation(); selectedId=null; selectedSeries=(selectedSeries==='c2')?null:'c2'; renderStyles();});

    // histogram
    const b1x = binnerX(d1);
    const b2x = binnerX(d2);
    curB1x = b1x;
    curB2x = b2x;

    const maxX = d3.max([ d3.max(b1x,b=>b.length)||0, d3.max(b2x,b=>b.length)||0 ]) || 1;
    yCountX.domain([0,maxX]).nice();

    barsX1.selectAll("rect").data(b1x)
      .join("rect")
      .attr("x", b=>xScaleX(b.x0))
      .attr("y", b=>yCountX(b.length))
      .attr("width", b=>Math.max(1, xScaleX(b.x1)-xScaleX(b.x0)))
      .attr("height", b=>histHeight - yCountX(b.length))
      .attr("fill","#60a5fa")
      .attr("stroke","#60a5fa")
      .attr("stroke-width",1)
      .style("pointer-events","all")
      .on("mouseover",(evt,b)=> {
        const range = `${fmt2(b.x0)}–${fmt2(b.x1)}`;
        showTip(`<strong>${c1}</strong><br>x bin: ${range}<br>count: ${b.length}`, evt);
      })
      .on("mousemove", moveTip)
      .on("mouseout", hideTip);

    barsX2.selectAll("rect").data(b2x)
      .join("rect")
      .attr("x", b=>xScaleX(b.x0))
      .attr("y", b=>yCountX(b.length))
      .attr("width", b=>Math.max(1, xScaleX(b.x1)-xScaleX(b.x0)))
      .attr("height", b=>histHeight - yCountX(b.length))
      .attr("fill","#f5ed0bff")
      .attr("stroke","#f5ed0bff")
      .attr("stroke-width",1)
      .style("pointer-events","all")
      .on("mouseover",(evt,b)=> {
        const range = `${fmt2(b.x0)}–${fmt2(b.x1)}`;
        showTip(`<strong>${c2}</strong><br>x bin: ${range}<br>count: ${b.length}`, evt);
      })
      .on("mousemove", moveTip)
      .on("mouseout", hideTip);

    yAxisXG.call(d3.axisLeft(yCountX).ticks(4));
    xAxisXG.call(d3.axisBottom(xScaleX).ticks(10).tickFormat(d3.format(".1f")));

    // density charts
    renderDensityCharts(d1, d2, c1, c2);

    // update data cards
    updateCards(d1, d2, fit1, fit2);

    // final styles
    renderStyles();
  }

  // events
  d3.select("#cat1").on("change", update);
  d3.select("#cat2").on("change", update);
  d3.select(window).on("keydown",(evt)=>{
    if (evt.key === "Escape") { selectedId=null; selectedSeries=null; renderStyles(); }
  });

  update();
});
