    /* Placed in the holder's pixel space: the cube's centre is half its depth
     * above the feet, and the sprite's anchor is its own feet. */
    const depth = obj.getDepth() || 32;
    const baseZ = -depth / 2 + 0.7;
    rig.shadow.position.set(0, 0, -depth / 2 + 0.35);
    rig.root.updateMatrixWorld(true);
    rig.root.getWorldPosition(world);
    let moved = 0;
    if (rig.lastX !== null && rig.lastY !== null) {
      const stepX = world.x - rig.lastX;
      const stepY = world.y - rig.lastY;
      moved = Math.sqrt(stepX * stepX + stepY * stepY);
      if (moved > 0.05 && moved < 400 && right) {
        const camera = cameraRight(obj, right);
        if (camera) {
          const side = stepX * camera.x + stepY * camera.y;
          if (Math.abs(side) > 0.5) {
            rig.mirror = side < 0;
            /* v1.3.0: the body leans the way it runs - clockwise when it runs to
             * the right of the screen, counter-clockwise when it runs left. */
            rig.leanGoal = rig.mirror ? 0.13 : -0.13;
          }
        }
      }
    }
    rig.lastX = world.x;
    rig.lastY = world.y;
    const running = moved > 0.05 && moved < 400;
    /* The run cycle advances with the distance walked, so the feet keep up with
     * the floor instead of paddling on the spot (Build 33 turns it at nine
     * pixels a frame instead of fifteen: the legs are seen moving, not posing). */
    if (running) rig.walk += moved;
    if (!running) rig.leanGoal = 0;
    const frame = running ? Math.floor(rig.walk / STEPS_PER_FRAME) % FRAME_COUNT : 0;
    if (frame !== rig.frame || !rig.map) {
      rig.frame = frame;
      rig.map.repeat.set(rig.mirror ? -CELL_U : CELL_U, 1);
      rig.map.offset.set(rig.mirror ? (frame + 1) * CELL_U : frame * CELL_U, 0);
    } else if (rig.map.repeat.x < 0 !== rig.mirror) {
      rig.map.repeat.set(rig.mirror ? -CELL_U : CELL_U, 1);
      rig.map.offset.set(rig.mirror ? (frame + 1) * CELL_U : frame * CELL_U, 0);
    }
    /* v1.3.0: the stride lifts the body - two footfalls per four-frame cycle, so
     * the rise and the legs are on the same clock - and the lean eases in. */
    const bob = running ? Math.abs(Math.sin((rig.walk / (STEPS_PER_FRAME * FRAME_COUNT)) * Math.PI * 2)) * 6.5 : 0;
    rig.bob += (bob - rig.bob) * 0.45;
    rig.lean += (rig.leanGoal - rig.lean) * 0.22;
    rig.sprite.position.set(0, 0, baseZ + rig.bob);
    if (rig.sprite.material) rig.sprite.material.rotation = view.frozen ? 0 : rig.lean;
    /* v1.3.0: the snow the feet kick up, and a puff of frost when the ice lands. */
    if (snowSpray && typeof snowSpray.emit === 'function') {
      rig.runSpeed = running ? Math.min(420, moved / 0.016) : 0;
      if (running && moved > 1.1) snowSpray.emit(world.x, world.y, rig.runSpeed, false);
      if (view.frozen && rig.wasFrozen !== true) snowSpray.emit(world.x, world.y, 380, true);
      rig.wasFrozen = view.frozen;
    }
    const tint = view.frozen ? 0.66 : 1;
    rig.sprite.material.color.setRGB(tint * 0.94, tint, 1);
    rig.shadow.visible = true;
    const shrink = view.frozen ? 0.94 : 1;
    rig.sprite.scale.set(BODY_WIDTH * shrink, BODY_HEIGHT * shrink, 1);
