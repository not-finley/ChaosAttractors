// const NUM_POINTS = 64*5000;
// const WORKGROUP_SIZE = 64;
// const UPDATE_INTERVAL =16;// Time in milliseconds between updates
// const DT = 0.005; // Time step for the simulation

// const canvas = document.querySelector("canvas");
// canvas.width = Math.min(window.innerWidth, window.innerHeight) * 0.8;
// canvas.height = Math.min(window.innerWidth, window.innerHeight) * 0.8;

// if (!navigator.gpu) {
//     throw new Error("WebGPU not supported on this browser.");
// }

// const adapter = await navigator.gpu.requestAdapter();
// if (!adapter) {
//     throw new Error("No appropriate GPUAdapter found.");
// }

// const device = await adapter.requestDevice();
// const context = canvas.getContext("webgpu");
// const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
// context.configure({
//     device,
//     format: canvasFormat,
// });

// // Initialize particle positions
// const initialState = new Float32Array(NUM_POINTS * 3);
// for (let i = 0; i < NUM_POINTS; i++) {
//     initialState[i * 3] = Math.random() * 7 - 3.5; // x-coordinate
//     initialState[i * 3 + 1] = Math.random()  * 7 - 3.5; // y-coordinates
//     initialState[i * 3 + 2] = Math.random()  * 6 - 3; // z-coordinate
// }



// console.log(initialState);
// // Create two storage buffers to alternate between compute passes
// const attractorBufferA = device.createBuffer({
//     label: "Attractor Buffer A",
//     size: initialState.byteLength,
//     usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX,
// });
// const attractorBufferB = device.createBuffer({
//     label: "Attractor Buffer B",
//     size: initialState.byteLength,
//     usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX,
// });
// device.queue.writeBuffer(attractorBufferA, 0, initialState);
// device.queue.writeBuffer(attractorBufferB, 0, initialState);

// // Define the vertex buffer layout
// const vertexBufferLayout = {
//     arrayStride: 3 * 4, // 3 floats for position (vec3f)
//     attributes: [{ format: 'float32x3', offset: 0, shaderLocation: 0 }],
// };

// // Vertex and fragment shaders
// const cellShaderModule = device.createShaderModule({
//     label: "Cell Shader Module",
//     code: `
//         struct Vertex {
//             @location(0) position: vec3f,
//         };

//         struct VSOutput {
//             @builtin(position) position: vec4f,
//         };

//         @vertex
//         fn vertexMain(vert: Vertex) -> VSOutput {
//             var vsOut: VSOutput;
//             vsOut.position = vec4f(vert.position.x / 40.0, vert.position.y / 40.0, 1.0, 1.0);
//             return vsOut;
//         }

//         @fragment
//         fn fragmentMain(vsOut: VSOutput) -> @location(0) vec4f {
//             return vec4f(0.9, 0.9, 0.9, 1.0);
//         }
//     `,
// });

// // Compute shader for the Lorenz attractor simulation
// const simulationShaderModule = device.createShaderModule({
//     label: "Lorenz Attractor Simulation",
//     code: `
//         @group(0) @binding(0) var<storage> input: array<f32>;
//         @group(0) @binding(1) var<storage, read_write> output: array<f32>;

//         const dt = ${DT};
//         const b = 0.19;
//         //const b = 0.208186;
//         const sigma = 10.0;
//         const beta = 8.0/3.0;
//         const phi = 28.0;
//         @compute
//         @workgroup_size(${WORKGROUP_SIZE})
//         fn computeMain(@builtin(global_invocation_id) id: vec3u) {
//             let i = id.x;
//             let pos = vec3f(input[i * 3], input[i * 3 + 1], input[i * 3 + 2]);
//             // let dx = (-b * pos.x + sin(pos.y)) * dt;
//             // let dy = (-b * pos.y + sin(pos.z)) * dt;
//             // let dz = (-b * pos.z + sin(pos.x)) * dt;

//             let dx = (sigma *(pos.y - pos.x)) * dt;
//             let dy = (pos.x * (phi - pos.z)) * dt;
//             let dz = (pos.x * pos.y - beta * pos.z) * dt;

//             output[i * 3] = pos.x + dx;
//             output[i * 3 + 1] = pos.y + dy;
//             output[i * 3 + 2] = pos.z + dz;
//         }
//     `,
// });

// // Create bind group layouts and bind groups
// const bindGroupLayout = device.createBindGroupLayout({
//     label: "Bind Group Layout",
//     entries: [
//         { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
//         { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
//     ],
// });

// const bindGroups = [
//     device.createBindGroup({
//         layout: bindGroupLayout,
//         entries: [
//             { binding: 0, resource: { buffer: attractorBufferA } },
//             { binding: 1, resource: { buffer: attractorBufferB } },
//         ],
//     }),
//     device.createBindGroup({
//         layout: bindGroupLayout,
//         entries: [
//             { binding: 0, resource: { buffer: attractorBufferB } },
//             { binding: 1, resource: { buffer: attractorBufferA } },
//         ],
//     }),
// ];

// // Create pipelines
// const pipelineLayout = device.createPipelineLayout({
//     label: "Pipeline Layout",
//     bindGroupLayouts: [bindGroupLayout],
// });

// const cellPipeline = device.createRenderPipeline({
//     label: "Cell Pipeline",
//     layout: pipelineLayout,
//     vertex: {
//         module: cellShaderModule,
//         entryPoint: "vertexMain",
//         buffers: [vertexBufferLayout],
//     },
//     fragment: {
//         module: cellShaderModule,
//         entryPoint: "fragmentMain",
//         targets: [{ format: canvasFormat }],
//     },
//     primitive: {
//         topology: "point-list", // Render individual points
//     },
// });

// const simulationPipeline = device.createComputePipeline({
//     label: "Simulation Pipeline",
//     layout: pipelineLayout,
//     compute: {
//         module: simulationShaderModule,
//         entryPoint: "computeMain",
//     },
// });

// // Update and render loop
// let step = 0;
// async function updateGrid() {
//     const encoder = device.createCommandEncoder();

//     // Compute pass to update particle positions
//     const computePass = encoder.beginComputePass();
//     computePass.setPipeline(simulationPipeline);
//     computePass.setBindGroup(0, bindGroups[step % 2]);
//     const workgroupCount = Math.ceil(NUM_POINTS / WORKGROUP_SIZE);
//     computePass.dispatchWorkgroups(workgroupCount);
//     computePass.end();

//     // Render pass to draw particles
//     const renderPass = encoder.beginRenderPass({
//         colorAttachments: [
//             {
//                 view: context.getCurrentTexture().createView(),
//                 loadOp: "clear",
//                 clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
//                 storeOp: "store",
//             },
//         ],
//     });
//     renderPass.setPipeline(cellPipeline);
//     renderPass.setVertexBuffer(0, step % 2 === 0 ? attractorBufferA : attractorBufferB);
//     renderPass.setBindGroup(0, bindGroups[step % 2]);
//     renderPass.draw(NUM_POINTS);
//     renderPass.end();

//     device.queue.submit([encoder.finish()]);
//     step++;
// }

// // Run the update loop
// setInterval(updateGrid, UPDATE_INTERVAL);

const NUM_POINTS_DEFAULT = 64 * 8000; // Default number of points
let NUM_POINTS = NUM_POINTS_DEFAULT;
const WORKGROUP_SIZE = 64;
const UPDATE_INTERVAL = 16; // Time in milliseconds between updates
let SCALER = 40.0;
let DT = 0.005; // Time step for the simulation

const canvas = document.querySelector("canvas");
canvas.width = Math.min(window.innerWidth, window.innerHeight) * 0.8;
canvas.height = Math.min(window.innerWidth, window.innerHeight) * 0.8;

if (!navigator.gpu) {
    throw new Error("WebGPU not supported on this browser.");
}

const adapter = await navigator.gpu.requestAdapter();
if (!adapter) {
    throw new Error("No appropriate GPUAdapter found.");
}

const device = await adapter.requestDevice();
const context = canvas.getContext("webgpu");
const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
context.configure({
    device,
    format: canvasFormat,
});

// Initial state buffer for particles
let initialState = new Float32Array(NUM_POINTS * 3);
for (let i = 0; i < NUM_POINTS; i++) {
    initialState[i * 3] = Math.random() * 7 - 3.5; // x-coordinate
    initialState[i * 3 + 1] = Math.random() * 7 - 3.5; // y-coordinate
    initialState[i * 3 + 2] = Math.random() * 6 - 3; // z-coordinate
}

// Create storage buffers
const attractorBufferA = device.createBuffer({
    label: "Attractor Buffer A",
    size: initialState.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX,
});
const attractorBufferB = device.createBuffer({
    label: "Attractor Buffer B",
    size: initialState.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX,
});
device.queue.writeBuffer(attractorBufferA, 0, initialState);
device.queue.writeBuffer(attractorBufferB, 0, initialState);

// Create bind groups and pipeline layout
const bindGroupLayout = device.createBindGroupLayout({
    label: "Bind Group Layout",
    entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
    ],
});

let simulationShaderModule = createSimulationShader("Lorenz");
const vertexBufferLayout = {
    arrayStride: 3 * 4, // 3 floats for position (vec3f)
    attributes: [{ format: 'float32x3', offset: 0, shaderLocation: 0 }],
};


// Vertex and fragment shaders
let cellShaderModule = device.createShaderModule({
    label: "Cell Shader Module",
    code: `
        struct Vertex {
            @location(0) position: vec3f,
        };

        struct VSOutput {
            @builtin(position) position: vec4f,
        };

        @vertex
        fn vertexMain(vert: Vertex) -> VSOutput {
            var vsOut: VSOutput;
            vsOut.position = vec4f(vert.position.x / ${SCALER}, vert.position.y / ${SCALER}, 1.0, 1.0);
            return vsOut;
        }

        @fragment
        fn fragmentMain(vsOut: VSOutput) -> @location(0) vec4f {
            return vec4f(0.9, 0.9, 0.9, 1.0);
        }
    `,
});
const bindGroups = [
    device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
            { binding: 0, resource: { buffer: attractorBufferA } },
            { binding: 1, resource: { buffer: attractorBufferB } },
        ],
    }),
    device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
            { binding: 0, resource: { buffer: attractorBufferB } },
            { binding: 1, resource: { buffer: attractorBufferA } },
        ],
    }),
];

const pipelineLayout = device.createPipelineLayout({
    label: "Pipeline Layout",
    bindGroupLayouts: [bindGroupLayout],
});

let cellPipeline = device.createRenderPipeline({
    label: "Cell Pipeline",
    layout: pipelineLayout,
    vertex: {
        module: cellShaderModule,
        entryPoint: "vertexMain",
        buffers: [vertexBufferLayout],
    },
    fragment: {
        module: cellShaderModule,
        entryPoint: "fragmentMain",
        targets: [{ format: canvasFormat }],
    },
    primitive: {
        topology: "point-list", // Render individual points
    },
});

let simulationPipeline = device.createComputePipeline({
    label: "Simulation Pipeline",
    layout: pipelineLayout,
    compute: {
        module: simulationShaderModule,
        entryPoint: "computeMain",
    },
});
// Function to dynamically update the simulation shader
function createSimulationShader(attractorType) {
    let shaderCode = "";
    if (attractorType === "Lorenz") {
        shaderCode = `
            @group(0) @binding(0) var<storage> input: array<f32>;
            @group(0) @binding(1) var<storage, read_write> output: array<f32>;
            const dt = ${DT};
            const sigma = 10.0;
            const phi = 28.0;
            const beta = 8.0 / 3.0;
            @compute
            @workgroup_size(${WORKGROUP_SIZE})
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
                let i = id.x;
                let pos = vec3f(input[i * 3], input[i * 3 + 1], input[i * 3 + 2]);
                let dx = (sigma * (pos.y - pos.x)) * dt;
                let dy = (pos.x * (phi - pos.z)) * dt;
                let dz = (pos.x * pos.y - beta * pos.z) * dt;
                output[i * 3] = pos.x + dx;
                output[i * 3 + 1] = pos.y + dy;
                output[i * 3 + 2] = pos.z + dz;
            }
        `;
    } else if (attractorType === "Thomas") {
        shaderCode = `
            @group(0) @binding(0) var<storage> input: array<f32>;
            @group(0) @binding(1) var<storage, read_write> output: array<f32>;
            const dt = ${DT};
            const b = 0.19;
            @compute
            @workgroup_size(${WORKGROUP_SIZE})
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
                let i = id.x;
                let pos = vec3f(input[i * 3], input[i * 3 + 1], input[i * 3 + 2]);
                let dx = (-b * pos.x + sin(pos.y)) * dt;
                let dy = (-b * pos.y + sin(pos.z)) * dt;
                let dz = (-b * pos.z + sin(pos.x)) * dt;

                output[i * 3] = pos.x + dx;
                output[i * 3 + 1] = pos.y + dy;
                output[i * 3 + 2] = pos.z + dz;
            }
        `;
    }
    return device.createShaderModule({
        label: "Simulation Shader",
        code: shaderCode,
    });
}

function createVertexShader(attractorType) {
    let shaderCode = "";
    if (attractorType === "Lorenz") {
            shaderCode = `
            struct Vertex {
                @location(0) position: vec3f,
            };

            struct VSOutput {
                @builtin(position) position: vec4f,
            };

            @vertex
            fn vertexMain(vert: Vertex) -> VSOutput {
                var vsOut: VSOutput;
                vsOut.position = vec4f(vert.position.x / 40.0, vert.position.y / 40.0, 1.0, 1.0);
                return vsOut;
            }

            @fragment
            fn fragmentMain(vsOut: VSOutput) -> @location(0) vec4f {
                return vec4f(0.9, 0.9, 0.9, 1.0);
            }
        `;
    } else if (attractorType === "Thomas") {
            shaderCode = `
            struct Vertex {
                @location(0) position: vec3f,
            };

            struct VSOutput {
                @builtin(position) position: vec4f,
            };

            @vertex
            fn vertexMain(vert: Vertex) -> VSOutput {
                var vsOut: VSOutput;
                vsOut.position = vec4f(vert.position.x / 5.0, vert.position.y / 5.0, 1.0, 1.0);
                return vsOut;
            }

            @fragment
            fn fragmentMain(vsOut: VSOutput) -> @location(0) vec4f {
                return vec4f(0.9, 0.9, 0.9, 1.0);
            }
        `;
    }
    return device.createShaderModule({
        label: "Cell Shader Module",
        code: shaderCode,
    });
}

// Handle attractor selection change
const attractorSelect = document.getElementById("attractor-select");
attractorSelect.addEventListener("change", (event) => {
    const selectedAttractor = event.target.value;
    if (selectedAttractor == "Lorenz") {
        DT = 0.005;
        SCALER = 40.0;
    } else if (selectedAttractor == "Thomas") {
        DT = 0.1;
        SCALER = 1.0;
        console.log(SCALER);
    }
    simulationShaderModule = createSimulationShader(selectedAttractor);
    cellShaderModule = createVertexShader(selectedAttractor);
    const newSimulationPipeline = device.createComputePipeline({
        label: "New Simulation Pipeline",
        layout: pipelineLayout,
        compute: {
            module: simulationShaderModule,
            entryPoint: "computeMain",
        },
    });
    // Recreate the compute pipeline with the new shader
    simulationPipeline = newSimulationPipeline;

    cellPipeline = device.createRenderPipeline({
        label: "Cell Pipeline",
        layout: pipelineLayout,
        vertex: {
            module: cellShaderModule,
            entryPoint: "vertexMain",
            buffers: [vertexBufferLayout],
        },
        fragment: {
            module: cellShaderModule,
            entryPoint: "fragmentMain",
            targets: [{ format: canvasFormat }],
        },
        primitive: {
            topology: "point-list", // Render individual points
        },
    });
});

// Handle slider change for number of points
const slider = document.getElementById("myRange");
slider.addEventListener("input", (event) => {
    NUM_POINTS = event.target.value * 64 * 80;
    // Reallocate buffers with new number of points
    initialState = new Float32Array(NUM_POINTS * 3);
    for (let i = 0; i < NUM_POINTS; i++) {
        initialState[i * 3] = Math.random() * 7 - 3.5;
        initialState[i * 3 + 1] = Math.random() * 7 - 3.5;
        initialState[i * 3 + 2] = Math.random() * 6 - 3;
    }
    device.queue.writeBuffer(attractorBufferA, 0, initialState);
    device.queue.writeBuffer(attractorBufferB, 0, initialState);
    // Update bind group if necessary (if buffer changes)
    bindGroups[0] = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
            { binding: 0, resource: { buffer: attractorBufferA } },
            { binding: 1, resource: { buffer: attractorBufferB } },
        ],
    });
    bindGroups[1] = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
            { binding: 0, resource: { buffer: attractorBufferB } },
            { binding: 1, resource: { buffer: attractorBufferA } },
        ],
    });
});

const reset = document.getElementById("reset");
reset.addEventListener("click", () => {
    // Reallocate buffers with new number of points
    initialState = new Float32Array(NUM_POINTS * 3);
    for (let i = 0; i < NUM_POINTS; i++) {
        initialState[i * 3] = Math.random() * 7 - 3.5;
        initialState[i * 3 + 1] = Math.random() * 7 - 3.5;
        initialState[i * 3 + 2] = Math.random() * 6 - 3;
    }
    device.queue.writeBuffer(attractorBufferA, 0, initialState);
    device.queue.writeBuffer(attractorBufferB, 0, initialState);
    // Update bind group if necessary (if buffer changes)
    bindGroups[0] = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
            { binding: 0, resource: { buffer: attractorBufferA } },
            { binding: 1, resource: { buffer: attractorBufferB } },
        ],
    });
    bindGroups[1] = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
            { binding: 0, resource: { buffer: attractorBufferB } },
            { binding: 1, resource: { buffer: attractorBufferA } },
        ],
    });
})


// Update and render loop
let step = 0;
async function updateGrid() {
    const encoder = device.createCommandEncoder();

    // Compute pass to update particle positions
    const computePass = encoder.beginComputePass();
    computePass.setPipeline(simulationPipeline);
    computePass.setBindGroup(0, bindGroups[step % 2]);
    const workgroupCount = Math.ceil(NUM_POINTS / WORKGROUP_SIZE);
    computePass.dispatchWorkgroups(workgroupCount);
    computePass.end();

    // Render pass to draw particles
    const renderPass = encoder.beginRenderPass({
        colorAttachments: [
            {
                view: context.getCurrentTexture().createView(),
                loadOp: "clear",
                clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                storeOp: "store",
            },
        ],
    });
    renderPass.setPipeline(cellPipeline);
    renderPass.setVertexBuffer(0, step % 2 === 0 ? attractorBufferA : attractorBufferB);
    renderPass.setBindGroup(0, bindGroups[step % 2]);
    renderPass.draw(NUM_POINTS);
    renderPass.end();

    device.queue.submit([encoder.finish()]);
    step++;
}

// Run the update loop
setInterval(updateGrid, UPDATE_INTERVAL);
