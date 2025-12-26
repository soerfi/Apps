import { EditorAction, EditorState, Layer, Transform, Preset } from '../types';
import { defaultStyles, applySnapping } from '../utils/editorUtils';


export const editorReducer = (state: EditorState, action: EditorAction): EditorState => {
    switch (action.type) {
        case '_SET_LAYERS':
            return { ...state, layers: action.payload, activeLayerId: action.payload[action.payload.length - 1]?.id || null };

        case 'ADD_COLOR_LAYER': {
            const newLayer: Layer = {
                id: `${action.payload.name}-${new Date().getTime()}`,
                name: action.payload.name,
                type: 'color',
                color: action.payload.color,
                visible: true, opacity: 1, blendMode: 'source-over',
                transform: { x: state.preset.width / 2, y: state.preset.height / 2, scale: 1, rotation: 0 },
                styles: JSON.parse(JSON.stringify(defaultStyles)),
            };
            return { ...state, layers: [...state.layers, newLayer], activeLayerId: newLayer.id };
        }

        case 'ADD_MASK': {
            const targetLayer = state.layers.find(l => l.id === action.payload.layerId);
            if (!targetLayer) return state;

            // Use a large fixed size for the mask canvas to allow painting anywhere
            const MASK_SIZE = 3000;
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = MASK_SIZE;
            maskCanvas.height = MASK_SIZE;
            const ctx = maskCanvas.getContext('2d');
            if (ctx) {
                if (action.payload.maskImage) {
                    const img = action.payload.maskImage;
                    // Use Math.min to CONTAIN the image within the 4000x4000 buffer
                    const scale = Math.min(MASK_SIZE / img.width, MASK_SIZE / img.height);
                    const nw = img.width * scale;
                    const nh = img.height * scale;
                    // Draw centered
                    ctx.drawImage(img, (MASK_SIZE - nw) / 2, (MASK_SIZE - nh) / 2, nw, nh);
                } else {
                    ctx.clearRect(0, 0, MASK_SIZE, MASK_SIZE);
                }
            }

            let maskTransform = { ...targetLayer.transform };

            if (action.payload.maskImage) {
                // We want the 4000px buffer (which now contains the image) to fit in the preset.
                // Since MASK_SIZE is square (4000), we fit it to the smallest preset dimension.
                const initialScale = Math.min(state.preset.width, state.preset.height) / MASK_SIZE;
                maskTransform = { x: state.preset.width / 2, y: state.preset.height / 2, scale: initialScale, rotation: 0 };
            }

            const maskLayer: Layer = {
                id: `mask-${new Date().getTime()}`,
                name: `Mask for ${targetLayer.name}`,
                type: 'mask',
                visible: true, opacity: 1, blendMode: 'source-over',
                transform: maskTransform,
                maskCanvas,
                isClippingMask: true,
                styles: JSON.parse(JSON.stringify(defaultStyles)),
                thumbnailUrl: maskCanvas.toDataURL(),
            };

            const index = state.layers.findIndex(l => l.id === action.payload.layerId);
            const newLayers = [...state.layers];
            // Auto-link the layer below it
            newLayers[index] = { ...newLayers[index], isMaskChild: true };
            newLayers.splice(index + 1, 0, maskLayer);

            return { ...state, layers: newLayers, activeLayerId: maskLayer.id };
        }

        case 'UPDATE_MASK_CANVAS': {
            return {
                ...state,
                layers: state.layers.map(l => l.id === action.payload.layerId ? { ...l, maskCanvas: action.payload.canvas } : l)
            };
        }

        case 'INVERT_MASK': {
            return {
                ...state,
                layers: state.layers.map(l => {
                    if (l.id !== action.payload.layerId || !l.maskCanvas) return l;
                    const oldCanvas = l.maskCanvas;
                    const newCanvas = document.createElement('canvas');
                    newCanvas.width = oldCanvas.width;
                    newCanvas.height = oldCanvas.height;
                    const ctx = newCanvas.getContext('2d');
                    if (!ctx) return l;

                    // Draw old one
                    ctx.drawImage(oldCanvas, 0, 0);

                    // Invert
                    const imageData = ctx.getImageData(0, 0, newCanvas.width, newCanvas.height);
                    const data = imageData.data;
                    for (let i = 0; i < data.length; i += 4) {
                        data[i + 3] = 255 - data[i + 3]; // Invert Alpha (revealing/hiding)
                    }
                    ctx.putImageData(imageData, 0, 0);
                    return { ...l, maskCanvas: newCanvas };
                })
            };
        }

        case 'DELETE_LAYER': {
            const newLayers = state.layers.filter(l => l.id !== action.payload);
            let newActiveId = state.activeLayerId;
            if (state.activeLayerId === action.payload) {
                newActiveId = newLayers.length > 0 ? newLayers[newLayers.length - 1].id : null;
            }
            return { ...state, layers: newLayers, activeLayerId: newActiveId };
        }

        case 'SET_ACTIVE_LAYER':
            return { ...state, activeLayerId: action.payload };

        case 'TOGGLE_LAYER_VISIBILITY':
            return { ...state, layers: state.layers.map(l => l.id === action.payload ? { ...l, visible: !l.visible } : l) };

        case 'TOGGLE_CLIPPING_MASK': {
            const targetIdx = state.layers.findIndex(l => l.id === action.payload);
            if (targetIdx === -1) return state;

            const targetLayer = state.layers[targetIdx];
            const newIsClippingMask = !targetLayer.isClippingMask;

            const newLayers = [...state.layers];
            newLayers[targetIdx] = { ...targetLayer, isClippingMask: newIsClippingMask };

            // Logic to link/unlink the layer below
            if (targetIdx > 0) {
                const layerBelow = newLayers[targetIdx - 1];
                if (newIsClippingMask) {
                    // Turn ON: Force layer below to be a child
                    newLayers[targetIdx - 1] = { ...layerBelow, isMaskChild: true };
                } else {
                    // Turn OFF: Release layer below (if it was a child)
                    // Note: In complex groups, this might need more logic, but for simple toggle this is expected.
                    newLayers[targetIdx - 1] = { ...layerBelow, isMaskChild: false };
                }
            }
            return { ...state, layers: newLayers };
        }

        case 'TOGGLE_MASK_INVERSION':
            return {
                ...state,
                layers: state.layers.map(l => l.id === action.payload ? { ...l, isInverted: !l.isInverted } : l)
            };

        case 'TOGGLE_MASK_CHILD':
            return { ...state, layers: state.layers.map(l => l.id === action.payload ? { ...l, isMaskChild: !l.isMaskChild } : l) };

        case 'TOGGLE_LAYER_LOCK':
            return { ...state, layers: state.layers.map(l => l.id === action.payload ? { ...l, isLocked: !l.isLocked } : l) };

        case 'REORDER_LAYER': {
            const { draggedId, targetId, position } = action.payload;
            const layers = [...state.layers];
            const draggedIndex = layers.findIndex(l => l.id === draggedId);
            if (draggedIndex === -1) return state;

            const isMasker = (l: Layer) => l.type === 'mask' || l.isClippingMask;

            // 1. Identify what we are dragging
            // If it is a MASKER, we MUST drag the whole family.
            // If it is a CHILD or Normal layer, we drag ONLY ITSELF (allowing it to break free).
            let blockIndices = [draggedIndex];
            if (isMasker(layers[draggedIndex])) {
                let i = draggedIndex - 1;
                while (i >= 0 && layers[i].isMaskChild) {
                    blockIndices.unshift(i); // Add children below
                    i--;
                }
            }

            const draggedIds = blockIndices.map(idx => layers[idx].id);
            const dragBlock = layers.filter(l => draggedIds.includes(l.id));
            const remainingLayers = layers.filter(l => !draggedIds.includes(l.id));

            // 2. Find target position in remaining layers
            let newTargetIndex = remainingLayers.findIndex(l => l.id === targetId);

            // If target is gone (because we dragged it?), default to end
            if (newTargetIndex === -1 && remainingLayers.length > 0) newTargetIndex = remainingLayers.length - 1;
            if (newTargetIndex === -1) return { ...state, layers: dragBlock }; // Only dragged items remain?

            // Insert Index
            let insertIndex = position === 'above' ? newTargetIndex + 1 : newTargetIndex;

            // 3. Smart Group Joining
            // Only apply if we are dragging a single non-masker item (i.e. potential child)
            if (dragBlock.length === 1 && !isMasker(dragBlock[0])) {
                // Look at what will be ABOVE the inserted item
                // If inserting at 0, nothing is above.
                // If inserting at N, the item at N-1 is above.
                // Note: 'remainingLayers' is currently missing the dragged item.
                // 'insertIndex' is where we will put it.
                // So the item conceptually "above" it will be remainingLayers[insertIndex] (since list is top-to-bottom indices... wait, standard is existing[insertIndex] becomes the item at that index, pushing others up? No, usually indices are 0..N)
                // Let's assume standard splice behavior: splice(i, 0, item) puts item AT i. Item previously at i becomes i+1.
                // Layers are rendered 0 (bottom) to N (top).
                // "Above" means Higher Index.

                // Let's look at the layer that will be seemingly "above" the new position.
                // Actually, let's just insert it and then check neighbors.
                // It is safer.
            }

            remainingLayers.splice(insertIndex, 0, ...dragBlock);

            // 4. Re-evaluate masking for the moved items
            // We iterate through the new list and fix isMaskChild logic for the moved items.
            // Actually, simplest is to just check the moved item's new context.
            const reevaluatedLayers = remainingLayers.map((layer, idx, arr) => {
                // We only *need* to change the dragged layers, but a full pass is robust.
                // However, we shouldn't break existing relationships we didn't touch.
                if (!draggedIds.includes(layer.id)) return layer;
                if (isMasker(layer)) return layer; // Maskers define their own destiny

                // It is a normal layer or child. Check if it should be a child.
                // Check layer ABOVE (index + 1)
                const layerAbove = arr[idx + 1];
                if (layerAbove && (isMasker(layerAbove) || layerAbove.isMaskChild)) {
                    return { ...layer, isMaskChild: true };
                } else {
                    return { ...layer, isMaskChild: false };
                }
            });

            return { ...state, layers: reevaluatedLayers };
        }

        case 'MOVE_LAYER': {
            const { layerId, direction } = action.payload;
            const layers = [...state.layers];
            const index = layers.findIndex(l => l.id === layerId);
            if (index === -1) return state;
            const isMasker = (l: Layer) => l.type === 'mask' || l.isClippingMask;

            // 1. Identify Block
            let blockIndices = [index];
            if (isMasker(layers[index])) {
                // If moving a masker, move its whole family
                let i = index - 1;
                while (i >= 0 && layers[i].isMaskChild) {
                    blockIndices.unshift(i); // Add children below
                    i--;
                }
            }
            // If moving a child, we move ONLY the child (blockIndices = [index])

            const block = layers.slice(blockIndices[0], blockIndices[blockIndices.length - 1] + 1);

            // 2. Determine Swaps
            if (direction === 'up') {
                // Move block UP: Swap with the item(s) immediately above the block.
                const blockTopIdx = blockIndices[blockIndices.length - 1];
                if (blockTopIdx < layers.length - 1) {
                    // Item above us
                    const itemAboveIdx = blockTopIdx + 1;
                    const itemAbove = layers[itemAboveIdx];

                    // If we are a child and moving up past our own masker, we just swap with the masker.
                    // If we are a masker/block, we swap with the item above.
                    // If the item above is part of *another* group (a child), we should probably skip the whole group?
                    // Standard Photoshop behavior: Swap with the visual "row" above.
                    // If above is a Child, keep going up until we find the Masker/Non-child? 
                    // No, for simplicity, let's just swap with strictly the adjacent index, logic will auto-fix types.

                    // Actually, if we just swap indices, we might break the "solid block" of the group above.
                    // But if we allow children to move freely, breaking blocks is fine!

                    // Perform simple swap of the block with the 1 item above
                    layers.splice(blockIndices[0], block.length); // Remove block
                    layers.splice(blockIndices[0] + 1, 0, ...block); // Insert 1 step higher
                }
            } else { // Down
                const blockBottomIdx = blockIndices[0];
                if (blockBottomIdx > 0) {
                    layers.splice(blockBottomIdx, block.length); // Remove block
                    layers.splice(blockBottomIdx - 1, 0, ...block); // Insert 1 step lower
                }
            }

            // 3. Re-evaluate status
            // Logic: Only the MOVING layer conforms to its new parent.
            // Passive layers DO NOT automatically join groups.
            const finalLayers = [...layers];

            // A. Update Moving Layer
            // A. Update Moving Layer
            const movedLayerIdx = finalLayers.findIndex(l => l.id === layerId);
            if (movedLayerIdx !== -1 && !isMasker(finalLayers[movedLayerIdx])) {
                const layer = finalLayers[movedLayerIdx];
                const layerAbove = finalLayers[movedLayerIdx + 1];
                const layerBelow = finalLayers[movedLayerIdx - 1];

                const isAboveMaskChain = layerAbove && (isMasker(layerAbove) || layerAbove.isMaskChild);
                const isBelowMaskChain = layerBelow && layerBelow.isMaskChild;

                if (layer.isMaskChild) {
                    // Leaving logic: Only leave if parent chain broken
                    if (!isAboveMaskChain) {
                        finalLayers[movedLayerIdx] = { ...layer, isMaskChild: false };
                    }
                } else {
                    // Joining logic: Only join if SANDWICHED
                    if (isAboveMaskChain && isBelowMaskChain) {
                        finalLayers[movedLayerIdx] = { ...layer, isMaskChild: true };
                    }
                }
            }

            // B. Prune Orphans (Top-Down)
            // Only fix invalid True->False. Never switch False->True here.
            for (let i = finalLayers.length - 1; i >= 0; i--) {
                const layer = finalLayers[i];
                if (isMasker(layer)) continue;
                if (!layer.isMaskChild) continue;

                const layerAbove = finalLayers[i + 1];
                const validParent = layerAbove && (isMasker(layerAbove) || layerAbove.isMaskChild);

                if (!validParent) {
                    finalLayers[i] = { ...layer, isMaskChild: false };
                }
            }

            return { ...state, layers: finalLayers };
        }

        case 'UPDATE_LAYER_PROPERTY': {
            const { layerId, prop, value } = action.payload;
            return {
                ...state,
                layers: state.layers.map(layer => {
                    if (layer.id !== layerId) return layer;
                    const [p1, p2, p3] = prop.split('.');
                    if (p3) return { ...layer, [p1]: { ...(layer as any)[p1], [p2]: { ...((layer as any)[p1] as any)[p2], [p3]: value } } };
                    if (p2) return { ...layer, [p1]: { ...(layer as any)[p1], [p2]: value } };
                    return { ...layer, [p1]: value };
                })
            };
        }
        case 'SET_LAYER_MASK': {
            const { layerId, maskImage } = action.payload;
            return {
                ...state,
                layers: state.layers.map(layer => layer.id === layerId ? { ...layer, maskImage: maskImage || undefined } : layer)
            };
        }
        case 'UPDATE_LAYER_TRANSFORM_RELATIVE': {
            const { layerId, delta, options } = action.payload;
            return {
                ...state, layers: state.layers.map(l => {
                    if (l.id !== layerId) return l;
                    let newTransform = { ...l.transform, x: l.transform.x + delta.dx, y: l.transform.y + delta.dy };
                    if (options.isSnapping) {
                        newTransform = applySnapping({ ...l, transform: newTransform }, state.preset, false);
                    }
                    return { ...l, transform: newTransform };
                })
            };
        }
        case 'UPDATE_LAYER_SCALE_FROM_POINT': {
            const { layerId, point, dScale, options } = action.payload;
            return {
                ...state, layers: state.layers.map(l => {
                    if (l.id !== layerId) return l;
                    const oldScale = l.transform.scale;
                    const newScale = Math.max(0.01, oldScale * dScale);
                    const worldX = (point.x - l.transform.x) / oldScale;
                    const worldY = (point.y - l.transform.y) / oldScale;
                    let newTransform = { ...l.transform, scale: newScale, x: point.x - worldX * newScale, y: point.y - worldY * newScale };
                    if (options.isSnapping) {
                        newTransform = applySnapping({ ...l, transform: newTransform }, state.preset, false);
                    }
                    return { ...l, transform: newTransform };
                })
            };
        }
        case 'MOVE_ACTIVE_LAYER_WITH_KEYBOARD': {
            const { key, shiftKey, metaKey, ctrlKey } = action.payload;
            const isSnap = metaKey || ctrlKey;
            const step = shiftKey ? 10 : 1;

            return {
                ...state, layers: state.layers.map(l => {
                    if (l.id !== state.activeLayerId) return l;
                    if (isSnap) {
                        const scaledWidth = (l.image?.width || state.preset.width) * l.transform.scale;
                        const scaledHeight = (l.image?.height || state.preset.height) * l.transform.scale;
                        let { x, y } = l.transform;
                        if (key === 'ArrowLeft') x = scaledWidth / 2;
                        if (key === 'ArrowRight') x = state.preset.width - scaledWidth / 2;
                        if (key === 'ArrowUp') y = scaledHeight / 2;
                        if (key === 'ArrowDown') y = state.preset.height - scaledHeight / 2;
                        return { ...l, transform: { ...l.transform, x, y } };
                    } else {
                        let { x, y } = l.transform;
                        if (key === 'ArrowUp') y -= step;
                        if (key === 'ArrowDown') y += step;
                        if (key === 'ArrowLeft') x -= step;
                        if (key === 'ArrowRight') x += step;
                        return { ...l, transform: { ...l.transform, x, y } };
                    }
                })
            };
        }
        case 'RESET_ACTIVE_LAYER': {
            return {
                ...state, layers: state.layers.map(l => {
                    if (l.id !== state.activeLayerId) return l;
                    let newTransform: Transform;
                    if (l.image) {
                        const scaleX = state.preset.width / l.image.width;
                        const scaleY = state.preset.height / l.image.height;
                        newTransform = { x: state.preset.width / 2, y: state.preset.height / 2, scale: Math.max(scaleX, scaleY), rotation: 0 };
                    } else {
                        newTransform = { x: state.preset.width / 2, y: state.preset.height / 2, scale: 1, rotation: 0 };
                    }
                    return { ...l, transform: newTransform, frame: undefined, styles: JSON.parse(JSON.stringify(defaultStyles)) };
                })
            };
        }

        case 'UPDATE_BRUSH_SETTINGS':
            return { ...state, brushSettings: { ...state.brushSettings, ...action.payload } };

        case 'RESET_STATE':
            return {
                ...state,
                layers: [],
                activeLayerId: null,
                history: { past: [], present: [], future: [] }
            };

        case 'UPDATE_PRESET':
            return { ...state, preset: action.payload };

        default:
            return state;
    }
};
