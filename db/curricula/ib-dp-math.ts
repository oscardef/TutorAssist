/**
 * IB Diploma Programme mathematics, guides for first assessment 2021.
 * Topic numbering and scope follow the guides; titles are our own short
 * wording (never guide prose). Entered from memory on 2026-10-30, then
 * checked against the official guides: Math AA (83 points) on 2026-10-30 and
 * Math AI (78 points) on 2026-10-31, same numbering; both 'verified'. SL lines
 * apply to SL and HL; AHL lines are HL only.
 */
import type { CurriculumSeed } from './types'

const AA = `
# 1 | Number and algebra
SL1.1 | Scientific notation and operations in standard form
SL1.2 | Arithmetic sequences and series
SL1.3 | Geometric sequences and series
SL1.4 | Financial applications: compound interest and depreciation
SL1.5 | Laws of exponents with integer exponents; introduction to logarithms
SL1.6 | Simple deductive proof and the language of proof
SL1.7 | Rational exponents, laws of logarithms and change of base
SL1.8 | Sum of an infinite convergent geometric series
SL1.9 | The binomial theorem with natural-number exponents
AHL1.10 | Counting principles, permutations and combinations; extended binomial theorem
AHL1.11 | Partial fractions
AHL1.12 | Complex numbers in Cartesian form
AHL1.13 | Modulus–argument and Euler forms; the Argand diagram
AHL1.14 | Conjugate roots, De Moivre's theorem, powers and roots of complex numbers
AHL1.15 | Proof by induction, contradiction and counterexample
AHL1.16 | Systems of linear equations in up to three unknowns
# 2 | Functions
SL2.1 | Equations of straight lines; parallel and perpendicular lines
SL2.2 | Functions: domain, range, graph and inverse
SL2.3 | Graphs of functions and sketching them
SL2.4 | Key features of graphs and intersections of curves
SL2.5 | Composite functions, identity function and finding inverses
SL2.6 | The quadratic function and its forms
SL2.7 | Quadratic equations and inequalities; the discriminant
SL2.8 | Reciprocal and simple rational functions; asymptotes
SL2.9 | Exponential and logarithmic functions and their graphs
SL2.10 | Solving equations graphically and analytically
SL2.11 | Transformations of graphs
AHL2.12 | Polynomial functions; factor and remainder theorems; sums and products of roots
AHL2.13 | Further rational functions and their asymptotes
AHL2.14 | Odd and even functions; inverses on restricted domains; self-inverse functions
AHL2.15 | Solving inequalities graphically and analytically
AHL2.16 | Graphs of |f(x)|, f(|x|), 1/f(x), f(ax+b) and [f(x)]²
# 3 | Geometry and trigonometry
SL3.1 | Distance and midpoint in 3D; volume and surface area of solids; angle between a line and a plane
SL3.2 | Right-angled trigonometry; sine rule, cosine rule and triangle area
SL3.3 | Applications: bearings, angles of elevation and depression
SL3.4 | Radian measure; arc length and sector area
SL3.5 | Unit circle definitions; exact values; ambiguous case of the sine rule
SL3.6 | Pythagorean identity and double-angle identities
SL3.7 | Circular functions and their graphs; transformations
SL3.8 | Solving trigonometric equations on a finite interval
AHL3.9 | Reciprocal and inverse trigonometric functions
AHL3.10 | Compound-angle identities
AHL3.11 | Symmetry relationships between trigonometric functions
AHL3.12 | Vectors: representation, algebra and geometry
AHL3.13 | The scalar product and angles between vectors
AHL3.14 | Vector equation of a line; angle between lines
AHL3.15 | Parallel, intersecting and skew lines; points of intersection
AHL3.16 | The vector product and areas
AHL3.17 | Equations of a plane
AHL3.18 | Intersections and angles between lines and planes
# 4 | Statistics and probability
SL4.1 | Populations, samples and sampling techniques; types of data; outliers
SL4.2 | Presenting data: histograms, cumulative frequency, box plots
SL4.3 | Measures of central tendency and dispersion
SL4.4 | Correlation, Pearson's r and the regression line of y on x
SL4.5 | Basic probability: sample spaces, events, relative frequency
SL4.6 | Venn and tree diagrams; combined, exclusive, conditional and independent events
SL4.7 | Discrete random variables and expected value
SL4.8 | The binomial distribution
SL4.9 | The normal distribution and normal probabilities
SL4.10 | Regression line of x on y
SL4.11 | Formulae for conditional probability and independence
SL4.12 | Standardising normal variables; inverse normal with unknown parameters
AHL4.13 | Bayes' theorem
AHL4.14 | Variance of discrete random variables; continuous random variables and probability density functions
# 5 | Calculus
SL5.1 | Limits and the derivative as a rate of change
SL5.2 | Increasing and decreasing functions; reading f'(x) from a graph
SL5.3 | Differentiating polynomials and powers of x
SL5.4 | Tangents and normals
SL5.5 | Integration as anti-differentiation; definite integrals and area
SL5.6 | Standard derivatives; chain, product and quotient rules
SL5.7 | The second derivative and concavity
SL5.8 | Stationary points, optimisation and points of inflexion
SL5.9 | Kinematics: displacement, velocity, acceleration and distance
SL5.10 | Indefinite integrals of standard functions; integration by inspection
SL5.11 | Definite integrals analytically; areas between curves
AHL5.12 | Continuity, differentiability and differentiation from first principles
AHL5.13 | Limits with l'Hôpital's rule or Maclaurin series
AHL5.14 | Implicit differentiation, related rates and further optimisation
AHL5.15 | Further derivatives and integrals, including inverse trigonometric functions
AHL5.16 | Integration by substitution and by parts
AHL5.17 | Area with respect to the y-axis; volumes of revolution
AHL5.18 | First-order differential equations: Euler's method, separable, homogeneous, integrating factor
AHL5.19 | Maclaurin series and their uses
`

const AI = `
# 1 | Number and algebra
SL1.1 | Scientific notation and operations in standard form
SL1.2 | Arithmetic sequences and series
SL1.3 | Geometric sequences and series
SL1.4 | Financial applications: compound interest and depreciation
SL1.5 | Laws of exponents with integer exponents; introduction to logarithms
SL1.6 | Approximation: decimal places, significant figures, bounds and percentage error
SL1.7 | Amortisation and annuities with technology
SL1.8 | Systems of linear equations and polynomial equations with technology
AHL1.9 | Laws of logarithms
AHL1.10 | Simplifying expressions with rational exponents
AHL1.11 | Sum of an infinite geometric series
AHL1.12 | Complex numbers in Cartesian form
AHL1.13 | Polar and exponential forms of complex numbers
AHL1.14 | Matrices: algebra, determinants and inverses
AHL1.15 | Eigenvalues, eigenvectors, diagonalisation and matrix powers
# 2 | Functions
SL2.1 | Equations and gradients of straight lines
SL2.2 | Functions: domain, range, graph and inverse
SL2.3 | Graphs of functions with technology
SL2.4 | Key features of graphs and intersections of curves
SL2.5 | Modelling with linear, quadratic, exponential, cubic, variation and sinusoidal functions
SL2.6 | The modelling process
AHL2.7 | Composite functions and inverses on restricted domains
AHL2.8 | Transformations of graphs
AHL2.9 | Modelling with logarithmic, rational, logistic and piecewise functions
AHL2.10 | Logarithmic scales and linearising data
# 3 | Geometry and trigonometry
SL3.1 | Distance and midpoint in 3D; volume and surface area of solids; angle between a line and a plane
SL3.2 | Right-angled trigonometry; sine rule, cosine rule and triangle area
SL3.3 | Applications: bearings, angles of elevation and depression
SL3.4 | Arc length and sector area in degrees
SL3.5 | Perpendicular bisectors
SL3.6 | Voronoi diagrams
AHL3.7 | Radian measure
AHL3.8 | Unit circle, Pythagorean identity and trigonometric equations
AHL3.9 | Geometric transformations with matrices
AHL3.10 | Vectors: representation and algebra
AHL3.11 | Vector equation of a line
AHL3.12 | Vectors in kinematics
AHL3.13 | Scalar and vector products
AHL3.14 | Graph theory: vertices, edges, degree, connectedness
AHL3.15 | Adjacency matrices and walks
AHL3.16 | Tree and cycle algorithms: Kruskal, Prim, Chinese postman, travelling salesman
# 4 | Statistics and probability
SL4.1 | Collecting data and sampling
SL4.2 | Presenting data: histograms, cumulative frequency, box plots
SL4.3 | Measures of central tendency and dispersion
SL4.4 | Correlation, Pearson's r and linear regression
SL4.5 | Basic probability: sample spaces, events, relative frequency
SL4.6 | Venn and tree diagrams; combined and conditional events
SL4.7 | Discrete random variables and expected value
SL4.8 | The binomial distribution
SL4.9 | The normal distribution
SL4.10 | Spearman's rank correlation
SL4.11 | Hypothesis tests: χ² independence, χ² goodness of fit, t-test
AHL4.12 | Designing data collection; validity and reliability
AHL4.13 | Non-linear regression and the coefficient of determination
AHL4.14 | Linear combinations of random variables; unbiased estimators
AHL4.15 | Linear combinations of normal variables; the central limit theorem
AHL4.16 | Confidence intervals for a mean
AHL4.17 | The Poisson distribution
AHL4.18 | Critical values and regions; tests for a mean; Type I and II errors
AHL4.19 | Transition matrices and Markov chains
# 5 | Calculus
SL5.1 | Limits and the derivative as a rate of change
SL5.2 | Increasing and decreasing functions
SL5.3 | Differentiating polynomials and powers of x
SL5.4 | Tangents and normals
SL5.5 | Introduction to integration; area with technology
SL5.6 | Stationary points
SL5.7 | Optimisation in context
SL5.8 | The trapezoidal rule
AHL5.9 | Standard derivatives; chain, product and quotient rules; related rates
AHL5.10 | The second derivative and concavity
AHL5.11 | Definite and indefinite integration; substitution by inspection
AHL5.12 | Area with respect to the y-axis; volumes of revolution
AHL5.13 | Kinematics with calculus
AHL5.14 | Setting up and solving separable differential equations
AHL5.15 | Slope fields
AHL5.16 | Euler's method for first-order equations and coupled systems
AHL5.17 | Phase portraits for coupled linear systems
AHL5.18 | Second-order differential equations as coupled systems
`

const AA_NOTE = 'Structure and numbering checked against the IB DP Mathematics: analysis and approaches guide (first assessment 2021, ibo.org) on 2026-10-30; titles are our own short wording.'
const AI_NOTE = 'Structure and numbering checked against the IB DP Mathematics: applications and interpretation guide (first assessment 2021, ibo.org) on 2026-10-31; titles are our own short wording.'

export const IB_DP_MATH: CurriculumSeed[] = [
  { code: 'IBDP-AA-2021', framework: 'IB DP', name: 'Mathematics: analysis and approaches', shortName: 'Math AA', version: 'First assessment 2021', levels: ['SL', 'HL'], sourceNote: AA_NOTE, orderIndex: 10, outline: AA, status: 'verified' },
  { code: 'IBDP-AI-2021', framework: 'IB DP', name: 'Mathematics: applications and interpretation', shortName: 'Math AI', version: 'First assessment 2021', levels: ['SL', 'HL'], sourceNote: AI_NOTE, orderIndex: 20, outline: AI, status: 'verified' },
]

// Revised courses (first teaching August 2027, first assessment May 2029).
// Unit-level structure from the IB subject briefs (ibo.org, checked
// 2026-10-31); detailed syllabus points follow when the guides are public.
const AA_2029 = `
# A | Number and algebra
A1 | Sequences
A2 | Exponents and logarithms
A3 | Combinatorics
A4 | Complex numbers (HL only)
A5 | Proof and algebraic manipulation
# B | Functions
B1 | Representation of functions
B2 | Polynomial functions
B3 | Functions with asymptotes
B4 | Trigonometric functions
B5 | Transformations of graphs and functions
# C | Geometry
C1 | Surface areas, volumes and measurement in circles
C2 | Trigonometry and its applications
C3 | Vectors (HL only)
# D | Probability and statistics
D1 | Univariate data
D2 | Probability
D3 | Probability distributions
# E | Calculus
E1 | Principles of differential calculus
E2 | Techniques of differential calculus
E3 | Techniques of integral calculus
E4 | Problem-solving using calculus
E5 | Differential equations (HL only)
E6 | Maclaurin series (HL only)
`

const AI_2029 = `
# A | Functions
A1 | Representation of functions
A2 | Polynomial functions
A3 | Functions with asymptotes
A4 | Trigonometric functions
A5 | Piecewise functions
A6 | Transformations of graphs and functions (HL only)
# B | Number and algebra
B1 | Approximation and error
B2 | Sequences
B3 | Use of technology applications
B4 | Exponentials
B5 | Matrices (HL only)
# C | Geometry
C1 | Straight line geometry
C2 | Surface areas, volumes and measurement in circles
C3 | Trigonometry and its applications
C4 | Vectors (HL only)
C5 | Graph theory (HL only)
# D | Probability and statistics
D1 | Univariate data
D2 | Bivariate data
D3 | Probability
D4 | Probability distributions
D5 | Inferential statistics
# E | Calculus
E1 | Principles of differential calculus
E2 | Techniques of differential calculus
E3 | Techniques of integral calculus
E4 | Problem-solving using calculus
E5 | Differential equations (HL only)
`

const NOTE_2029 = 'Units from the IB subject brief for first assessment 2029 (ibo.org, checked 2026-10-31). Detailed syllabus points will be added from the full guide.'

IB_DP_MATH.push(
  { code: 'IBDP-AA-2029', framework: 'IB DP', name: 'Mathematics: analysis and approaches (revised)', shortName: 'Math AA 2029', version: 'First assessment 2029', levels: ['SL', 'HL'], sourceNote: NOTE_2029, orderIndex: 30, outline: AA_2029, status: 'verified' },
  { code: 'IBDP-AI-2029', framework: 'IB DP', name: 'Mathematics: applications and interpretation (revised)', shortName: 'Math AI 2029', version: 'First assessment 2029', levels: ['SL', 'HL'], sourceNote: NOTE_2029, orderIndex: 40, outline: AI_2029, status: 'verified' },
)
