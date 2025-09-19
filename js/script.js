//LAYOUT AND SIZING 
//Scatter Plots
const margin = {top:10, right:20, bottom:30, left:40};
const width  = 400 - margin.left - margin.right;
const height = 400 - margin.top - margin.bottom;

//Histograms
const gap = 20;
const histHeight = 220; 
const innerCombined = width * 2 + gap;

function createSVG(container, vbWidth, vbHeight){
return d3.select(container).append("svg")
.attr("viewBox", `0 0 ${vbWidth + margin.left + margin.right} ${vbHeight + margin.top + margin.bottom}`)
.attr("width","100%").attr("height","auto")
.append("g").attr("transform",`translate(${margin.left},${margin.top})`);
}

//Scatter SVG's
const svg1 = createSVG("#chart1", width, height);
const svg2 = createSVG("#chart2", width, height);

//Histograms SVG's
const histXSvg = createSVG("#histX", innerCombined, histHeight);
const barsX1   = histXSvg.append("g");
const barsX2   = histXSvg.append("g");
const yAxisXG  = histXSvg.append("g").attr("class", "axis");
const xAxisXG  = histXSvg.append("g").attr("class", "axis").attr("transform", `translate(0,${histHeight})`);

//Pull in csv data
d3.csv("data/datasaurus_dozen.csv", d => ({
dataset: d.dataset,
x: +d.x,
y: +d.y
})).then(data => {

//Dropdown box options
const cats = Array.from(new Set(data.map(d => d.dataset))).sort();
d3.select("#cat1").selectAll("option").data(cats).enter().append("option")
.attr("value", d => d).text(d => d);
d3.select("#cat2").selectAll("option").data(cats).enter().append("option")
.attr("value", d => d).text(d => d);
d3.select("#cat1").property("value", cats[0]);
d3.select("#cat2").property("value", cats[1] ?? cats[0]);

//Create scales for scatter plots
const x = d3.scaleLinear().domain(d3.extent(data, d => d.x)).nice().range([0, width]);
const y = d3.scaleLinear().domain(d3.extent(data, d => d.y)).nice().range([height, 0]);

svg1.append("g").attr("class","axis").attr("transform",`translate(0,${height})`).call(d3.axisBottom(x));
svg1.append("g").attr("class","axis").call(d3.axisLeft(y));

svg2.append("g").attr("class","axis").attr("transform",`translate(0,${height})`).call(d3.axisBottom(x));
svg2.append("g").attr("class","axis").call(d3.axisLeft(y));

const dots1 = svg1.append("g");
const dots2 = svg2.append("g");

//Histogram bins
const xExtent = d3.extent(data, d => d.x);
const thresholdsX = d3.ticks(xExtent[0], xExtent[1], 20);
const binnerX = d3.bin().domain(xExtent).thresholds(thresholdsX).value(d => d.x);

const xScaleX = d3.scaleLinear().domain(xExtent).range([0, innerCombined]);
const yCountX = d3.scaleLinear().range([histHeight, 0]).nice();

const barWidth = (bin) => xScaleX(bin.x1) - xScaleX(bin.x0);

//Update our charts with data
function update(){
    const c1 = d3.select("#cat1").property("value");
    const c2 = d3.select("#cat2").property("value");
    d3.select("#title1").text(c1);
    d3.select("#title2").text(c2);

    //Scatter plots
    const d1 = data.filter(d => d.dataset === c1);
    const d2 = data.filter(d => d.dataset === c2);

    dots1.selectAll("circle").data(d1)
      .join("circle")
        .attr("cx", d => x(d.x))
        .attr("cy", d => y(d.y))
        .attr("r", 4)
        .attr("fill", "#60a5fa");

    dots2.selectAll("circle").data(d2)
      .join("circle")
        .attr("cx", d => x(d.x))
        .attr("cy", d => y(d.y))
        .attr("r", 4)
        .attr("fill", "#f5ed0bff");

    //Histogram
    const b1x = binnerX(d1);
    const b2x = binnerX(d2);

    //Scale Y-Axis
    const maxX = d3.max([
      d3.max(b1x, b => b.length) || 0,
      d3.max(b2x, b => b.length) || 0
    ]) || 1;
    yCountX.domain([0, maxX]).nice();

    //Category 1 histogram formatting
    barsX1.selectAll("rect").data(b1x)
      .join("rect")
        .attr("x", b => xScaleX(b.x0))
        .attr("y", b => yCountX(b.length))
        .attr("width", b => barWidth(b))
        .attr("height", b => histHeight - yCountX(b.length))
        .attr("fill", "#60a5fa")
        .attr("fill-opacity", 0.45)
        .attr("stroke", "#60a5fa")
        .attr("stroke-opacity", 0.6)
        .style("pointer-events");

    //Category 2 histogram formatting
    barsX2.selectAll("rect").data(b2x)
      .join("rect")
        .attr("x", b => xScaleX(b.x0))
        .attr("y", b => yCountX(b.length))
        .attr("width", b => barWidth(b))
        .attr("height", b => histHeight - yCountX(b.length))
        .attr("fill", "#f5ed0bff")
        .attr("fill-opacity", 0.45)
        .attr("stroke", "#f5ed0bff")
        .attr("stroke-opacity", 0.6)
        .style("pointer-events");

    //Create Axes for Histogram
    yAxisXG.call(d3.axisLeft(yCountX).ticks(4));
    xAxisXG.call(d3.axisBottom(xScaleX).ticks(10).tickFormat(d3.format(".1f")));
  }

  //Update data on category change
  d3.select("#cat1").on("change", update);
  d3.select("#cat2").on("change", update);

  update();
});