/**
 * IB Middle Years and Primary Years mathematics. Structure from the IB's own
 * documents, read from copies hosted by schools because the IB does not
 * publish them openly (checked 2026-10-31): the MYP Mathematics guide (for
 * use from September 2014/January 2015, published May 2014) and the PYP
 * Mathematics scope and sequence (PYP110, published February 2009). Topic
 * names follow the documents; wording is our own. MYP topics marked
 * "(Extended)" belong to extended mathematics; the rest to standard and
 * extended. The MYP framework is not split by year: schools spread the
 * topics over MYP 1–5. PYP points are one per phase (1–4) of each strand.
 */
import type { CurriculumSeed } from './types'

const MYP = `
# N | Number
N1 | Forms of numbers: integers, fractions, decimals, standard form, surds and number systems
N2 | Sets and Venn diagrams
N3 | The four operations with integers, decimals and fractions
N4 | Primes, factors, highest common factor and lowest common multiple
N5 | Number lines and solution sets of inequalities
N6 | Estimation, rounding and significant figures
N7 | Units of measurement and currency conversion
N8 | Ratio, percentage, direct and inverse proportion
N9 | Number sequences
N10 | Integer exponents
N11 | Fractional exponents and radicals (Extended)
N12 | Logarithms of numbers (Extended)
N13 | Number bases (Extended)
# A | Algebra
A1 | Operations with algebraic terms; expanding and simplifying
A2 | Factorising linear and quadratic expressions
A3 | Substitution
A4 | Rearranging formulae
A5 | Algebraic fractions
A6 | Laws of exponents, including negative and fractional exponents
A7 | Patterns, sequences and general rules
A8 | Algorithms
A9 | Functions: linear, quadratic, exponential, sine and cosine; domain, range and transformations
A10 | Straight lines: gradient, intercept, parallel and perpendicular lines
A11 | Linear, quadratic and simultaneous equations
A12 | Linear inequalities and linear programming
A13 | Logarithms and their laws (Extended)
A14 | Logarithmic, rational, inverse and composite functions (Extended)
A15 | Non-linear inequalities (Extended)
A16 | Transformations of logarithmic, rational and trigonometric functions (Extended)
# G | Geometry and trigonometry
G1 | Geometric elements and their classification
G2 | Distance between points, and between a point and a line
G3 | Angle properties of triangles, parallel lines, polygons and circles
G4 | Triangles: Pythagoras' theorem, similarity and congruence
G5 | Perimeter, area and volume, including compound shapes
G6 | The Cartesian plane: coordinates, distance and midpoint
G7 | Trigonometric ratios in right-angled triangles
G8 | Transformations: rotation, reflection, translation and enlargement
G9 | Circle geometry: chords, angles, arcs and sectors
G10 | Three-dimensional coordinate geometry (Extended)
G11 | Proofs with similarity and congruence (Extended)
G12 | Vectors and the dot product (Extended)
G13 | Sine and cosine rules (Extended)
G14 | Trigonometric identities and equations (Extended)
G15 | Radians (Extended)
G16 | The unit circle and exact values (Extended)
# S | Statistics and probability
S1 | Collecting data and representing it in charts, histograms, scatter plots and box plots
S2 | Line of best fit
S3 | Sampling and inferences about populations
S4 | Measures of central tendency
S5 | Measures of dispersion: range and interquartile range
S6 | Probability of single, combined, independent and mutually exclusive events
S7 | Successive trials, tree diagrams and Venn diagrams
S8 | Standard deviation (Extended)
S9 | Conditional probability (Extended)
`

const PYP = `
# D | Data handling
D1 | Phase 1: sorting and labelling objects; pictographs and tally marks; chance in daily events
D2 | Phase 2: collecting data and graphing it to answer questions; describing likelihood
D3 | Phase 3: choosing graphs and scales; the mode; probability from experiments
D4 | Phase 4: mean, median, mode and range; spreadsheets; probability on a 0–1 scale
# M | Measurement
M1 | Phase 1: comparing and ordering objects and events
M2 | Phase 2: standard units for length, mass, capacity, money, temperature and time
M3 | Phase 3: perimeter, area and volume; reading scales; angle as rotation
M4 | Phase 4: formulas for perimeter, area and volume; accuracy; measuring and constructing angles
# S | Shape and space
S1 | Phase 1: describing and comparing shapes; paths, regions and boundaries
S2 | Phase 2: classifying 2D and 3D shapes; symmetry; directions and position
S3 | Phase 3: polygons; congruence and similarity; reflective and rotational symmetry
S4 | Phase 4: polyhedra; 2D views of 3D objects; scale; bearings
# P | Pattern and function
P1 | Phase 1: recognising, extending and creating patterns
P2 | Phase 2: number patterns; addition and subtraction as inverses
P3 | Phase 3: rules for patterns; functions; multiplication and division as inverses
P4 | Phase 4: algebraic expressions and equations; exponents and roots
# N | Number
N1 | Phase 1: counting, one-to-one correspondence and numerals
N2 | Phase 2: place value to hundreds; addition and subtraction facts; simple fractions
N3 | Phase 3: fractions and decimals to hundredths; the four operations; estimation
N4 | Phase 4: place value to millions and decimals; integers; ratios; fractions, decimals and percentages
`

const MYP_NOTE = 'Branches and topics from the IB MYP Mathematics guide (for use from September 2014/January 2015), read from a school-hosted copy on 2026-10-31; wording is our own. Check for a newer edition.'
const PYP_NOTE = 'Strands and phases from the IB PYP Mathematics scope and sequence (PYP110, February 2009), read from a school-hosted copy on 2026-10-31; wording is our own.'

export const IB_MYP_PYP: CurriculumSeed[] = [
  { code: 'IBMYP-MATH-2014', framework: 'IB MYP', name: 'MYP mathematics (standard and extended)', shortName: 'Mathematics', version: 'Guide for use from 2014', levels: ['Standard', 'Extended'], sourceNote: MYP_NOTE, orderIndex: 50, outline: MYP, status: 'verified' },
  { code: 'IBPYP-MATH-2009', framework: 'IB PYP', name: 'PYP mathematics scope and sequence', shortName: 'Mathematics', version: 'Scope and sequence 2009', levels: ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4'], sourceNote: PYP_NOTE, orderIndex: 60, outline: PYP, status: 'verified' },
]
