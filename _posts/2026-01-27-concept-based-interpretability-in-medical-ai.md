---
title: "Concept-Based Interpretability in Medical AI"
date: 2026-01-27
categories: [notes]
excerpt: "A structured outline for a comprehensive survey on concept-based interpretability methods in medical AI."
header:
  teaser: /assets/notes/cxai.png
tldr: "A structured outline for a comprehensive survey on concept-based interpretability methods in medical AI."
---

**Keywords:** concept, explainable AI (XAI), concept-based interpretability (C-XAI)

## 1. Introduction: Problem Framing and Motivation

Goal here is to frame C-XAI as a structural requirement of medical AI (not just a nice-to-have, but a necessity):

- The “black box” problem in high-stakes domains
- Why concepts matter in medical AI
- Constraints unique to medical AI (risk, accountability, regulation, etc.)
- Why feature attribution / saliency are structurally insufficient (the *where* vs. the *what/why*)
- Concepts as a shared language between model representations and clinical reasoning

> Medical AI requires concept-level explanations because clinicians reason in abstractions, not pixels.

---

## 2. Concepts and Methods: Scope and Taxonomy

### 2.1 Concept

#### What is a *concept*?

A concept should be:
- **Human-interpretable:** understandable to humans (ideally domain experts)
- **Semantically stable:** meaning does not drift arbitrarily across contexts
- **Functionally used by the model:** linked to computation that affects predictions

#### What *types of concepts* exist?
Focus on medical-relevant concepts, for example:
- **Expert-defined symbolic concepts:** clinically defined entities and criteria
- **Prototypes / parts:** example patches, regions, or representative instances
- **Latent basis concepts:** directions, subspaces, or distributions in representation space

#### What does *not* qualify as a concept?
- Individual neurons (unless shown to be stable + meaningful + causal)
- Saliency regions (“where”, not “what”)
- Class labels (endpoints, not explanatory primitives)
- Post-hoc visualizations without functional linkage
+ add info *why not*

### 2.2 Concept-Based Interpretability Methods

#### Definition of C-XAI method
A C-XAI method explicitly represents, extracts, or manipulates concepts to explain or control model behavior.

**Mechanism (how it operates on concepts)**
- **Represent:** explicitly encode concepts (e.g., concept vectors, prototypes, concept bottlenecks)
- **Extract:** discover concepts from internal representations (e.g., probes, concept discovery, sparse features aligned to human semantics)
- **Manipulate:** intervene on concepts to test/enforce causal influence (e.g., concept intervention, editing, activation steering)

**Goal (what it aims to do)**
- **Explain:** describe model behavior in concept-level terms
- **Control:** change behavior by intervening on concepts

#### Types of C-XAI methods (high-level)
- **Post-hoc:** Concept Activation Vectors (CAV), probing, Sparse Autoencoders (SAE)
- **Ante-hoc / self-explainable (by design):** Concept Bottleneck Models (CBM), prototype-based models
- **By supervision regime:** supervised / unsupervised / hybrid

> Clean taxonomy separating *concepts* (objects) from *methods* (operations).

---

## 3. Mechanisms: How Concepts Are Represented in Models

Explain *where concepts live* and *what form* they take inside neural networks. Do not just list method names:

- Concept representation forms: neurons, directions, subspaces, prototypes
- Supervised vs. unsupervised concept formation
- Localized vs. distributed concepts
- Monosemanticity vs. polysemanticity
- Linear Representation Hypothesis (LRH) and its limits

> **Key insight:** Many failures of C-XAI come from a mismatch between *assumed* and *actual* representation geometry (and the [reification fallacy](https://surajsrinivas.substack.com/p/the-reification-fallacy-interpretability)).

A mental model of concept representation that explains both successes and failures of existing methods.

---

## 4. Concept Usage: What Are Concepts Actually Used For?

Not just extract concepts, but assess *functional* relevance:

- Concept attribution (explanatory role)
- Concept diagnostics and model auditing
- Concept control and intervention (suppression, enhancement, counterfactuals)

**TODO:** Add a table mapping  
*C-XAI method* → *supported capabilities* → *clinical relevance/value*

Functional view of concepts as tools for explanation, debugging, and control (not just analysis artifacts).

---

## 5. Concept-Based Interpretability in Medical AI Pipelines

Place C-XAI inside real medical AI systems.

**TODO:**
- Distinguish: input medical knowledge integration vs. model architectures for diagnosis vs. clinician-facing outputs (textual explanations, counterfactuals).
- Decide scope: imaging only, or also other modalities (text, signals, tabular, multimodal).

**Content**
- Modalities and data types
  - Medical imaging (histopathology, radiology, dermatology, ophthalmology)
  - Clinical text (reports, notes)
  - Signals and measurements (ECG)
  - Multimodal combinations
- Modality-specific opportunities and constraints
  - Imaging: spatial, morphological concepts
  - Text: semantic and relational concepts
  - Signals: temporal and frequency-domain concepts
  - Multimodal: cross-concept alignment and consistency
- Where concepts attach in the pipeline
  - Input-level representations
  - Encoder / representation space
  - Aggregation mechanisms (Multiple Instance Learning (MIL) - bag-level labels with unlabeled instances; temporal models)
  - Decision and reasoning layers
- What works in practice vs. medical-specific failure modes
  - Data sparsity
  - Weak supervision
  - Modality mismatch

---

## 6. Evaluation: What Makes a Concept Explanation “Good”?

- Qualitative vs. quantitative evaluation
- Properties that matter in medicine
  - Faithfulness
  - Stability
  - Semantic coherence
  - Actionability
- Interpretability metrics
  - What can be measured
  - Why many current metrics are insufficient
- Clinical validation (human-in-the-loop)
  - Expert evaluation + user studies
  - Trust and utility

---

## 7. Open Research Directions, Challenges, and Future Outlook

- *Concept representations* for ViT (`SAE`) and MIL (`Concept MIL`)
- *Concept discovery* under weak supervision
- *Concept control* as a safety and alignment mechanism
- *Annotation bottleneck and scalability* (shift toward unsupervised concept discovery, e.g., `SAE`)
- *From concept explanation to concept reasoning* (neuro-symbolic interfaces; clinical rules as constraints)