# Biaxially Loaded RC Column

Small browser-based tool for exploring the nominal interaction surface of a reinforced concrete column under:

- axial load `N`
- biaxial bending `M_x`
- biaxial bending `M_y`

The app generates a 3D interaction surface, 2D slices, a sample solved state, and a Bresler reciprocal-load check.

## Files

- `index.html`  
  User interface, Plotly graphs, slice view, sample output, and Bresler UI.

- `solver.js`  
  Main mechanics code. This is where the section is solved for one `(ky, theta)` state and where the interaction surface is generated.

- `solver_helper.js`  
  Small math helpers used by the solver.

- `concrete_geometry.js`  
  Concrete compression block geometry. This file shows how the section is clipped, and how concrete area and centroid are calculated.

- `bresler.js`  
  Bresler reciprocal-load approximation based on the generated surface points.

## Main idea

For each chosen `(ky, theta)`:

1. Compute `c` and the equivalent stress block depth `a = k1 * c`.
2. Build the concrete compression polygon by clipping the section with the stress block boundary line.
3. Compute the concrete area and centroid from that polygon.
4. Compute concrete force and concrete moments.
5. Compute steel strains, steel forces, and steel moments.
6. Sum concrete and steel contributions to get total `N`, `M_x`, and `M_y`.

Then the code repeats this over a grid of `ky` and `theta` values to build the interaction surface.

## How concrete area is calculated

The concrete area is the area of the clipped compression polygon.

The steps are:

1. Start with the full rectangular section polygon.
2. Define the stress block boundary line for the current state.
3. Clip the section polygon by that line.
4. The remaining polygon is the concrete compression shape.
5. Use the shoelace formula to compute polygon area.
6. Use the polygon centroid formula to compute centroid.

In this project, that logic is in `concrete_geometry.js`.

## Coordinate convention

Section-plane coordinates in the solver use:

- `x` positive to the right
- `y` positive upward

The section origin for `X, Y` style coordinates is at the bottom-left corner of the section.  
The center-based `x, y` coordinates are measured from the section centroid.

## Notes

- Only states with `N >= 0` are kept for plotting.
- Bresler is an approximation and is separate from the main strain-compatibility solve.
- This project is meant for study / visualization and can be adjusted to match course notation if needed.
