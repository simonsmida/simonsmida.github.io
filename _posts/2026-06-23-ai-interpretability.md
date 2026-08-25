---
title: "A Map of AI Interpretability Research"
categories: [notes]
excerpt: "Interpretability is not a single problem. Different methods answer fundamentally different questions about neural networks."
tldr: "Most interpretability methods are trying to answer different questions. Attribution explains predictions, probes study representations, concept methods connect models to human concepts, and mechanistic interpretability attempts to recover the underlying computation."
header:
  teaser: /assets/notes/2026-06-23-ai-interpretability/thumbnail.png
published: false
interactive_map: true
---

<div
  class="interactive-map"
  data-interactive-map
  data-map-src="{{ '/assets/notes/2026-06-23-ai-interpretability/banner-map.svg' | relative_url }}"
  data-map-ignore="legend"
  aria-label="Interactive map of AI interpretability research">
  <p class="interactive-map__fallback">
    <a href="{{ '/assets/notes/2026-06-23-ai-interpretability/banner-map.svg' | relative_url }}">Open the interpretability map</a>
  </p>
</div>


## TL;DR

Presenting AI interpretability as a way of "understanding the black box" nature of neural networks is vague. Interpretability is **not a single problem**. It is a collection of methods answering different questions. Interpretability is about testing hypotheses about the model behavior.

---

**Note:** Inspiration for this article is based on the recent _[Not All Interpretability is Mechanistic](https://x.com/giangnguyen2412/status/2068743875527844200)_ post, which outlined the common misconception that everything related to doing "AI interpretability" automatically implies _mechanistic_ interpretability. Mechinterp is just one branch of a larger tree, or one region of our clickable interpretability map (image above).

---

## Background

An _artificial neural network_ is a successful machine learning model, that is used to solve problems that are difficult to implement manually. Instead of writing a solution by hand, we can design a structure for a model loosely inspired by human brains, specify a task, and let the optimization algorithm find a solution. And neural networks have been successful at solving many of the tasks we've thrown on them. But although we do have a solution, a predictive system, we are not provided with the algorithm, the individual mechanisms of how the solution was obtained.

## What is there to understand about neural networks? and why is it a "black box"?


Neural networks are often described as **black boxes**. Not because we do not understand what they are made of; people design the architecture, individual components, even the training procedure and objective. We can inspect every learnable parameter, every activation at any layer of interest.

The problem is that looking at large amounts of numbers does not tell us _what the network is doing_ and for _what reasons_. It is said that neural networks as a system are not actually _designed_, but rather _grown_. The goal of a neural net is to learn to approximate a function, which is represented by an algorithm which is _unknown_ to us. We can just observe its behavior.

Interpretability and explainability (often used interchangeably) emerged as an attempt to answer what is going on in these models, how they make decisions, and when they can break and why. There is not a single answer to these questions, different subfields offer different perspectives.


<section id="map-interpretability" data-map-section="interpretability" markdown="1">

## What is AI Interpretability?

Interpretability and explainability (terms often used interchangeably in the field) attempt to understand how the neural networks work beyond their architecture and training desings. There is not a consensus on a single definition, and the whole field evolved a bit chaotically.

[Lipton (2016)](https://arxiv.org/abs/1606.03490) in his _"The Mythos of Model Interpretability"_ showed that the world "interpretability" hides several incompatible goals. The question of interpretability is a question of _trust_, _robustness_, _predictability_ and _usefulness beyond prediction_.

How do we assess an intepretability method is good? How to evaluate it? These are the questions [Doshi-Velez and Kim (2017)](https://arxiv.org/abs/1702.08608) discussed in their work.


Is it meaningful to try to explain these black boxes? Why not come up with models interpretable by design? [Rudin (2019)](https://arxiv.org/abs/1811.10154) argues we should stop explaining black box ML models for high stakes domains and rather use interpretable model instead.

Over the years, various views on interpretability were introduced, and they often evolved independently. There were multiple pitfalls, crises, push backs, but to me this field is one of the most interesting and cool research areas there is. Below you can find an **outline of the main interpretability methods**, all af which are further discussed below:

- **1. Attribution** (saliency maps, LRP, DeepLIFT, Integrated Gradients, LIME, SHAP, Grad-CAM)
  - what parts of the input receive credit for the prediction 
- **2. Probing** (linear and structural probes)
  -  what information is represented
- **3. Prototype methods** (ProtoPNet)
  - which examples or patches support a decision
- **4. Concept methods** (CBMs, TCAV)
  - can model behavior be described using human concepts
- **5. Counterfactuals** (actionable recourse, contrastive explanations, DiCE) 
  - what would change the output
- **6. Mechanistic interpretability** (circuits, superposition, SAEs)
  - how the computation is implemented.

- **X. Inherently-interpretable models**
  - instead of black boxes, let's make the models interpretable by design while preserving good performance


In the image below you can see the rough timeline of AI interpretability approaches and the corresponding methods.

![Timeline of Interpretability Methods](/assets/notes/2026-06-23-ai-interpretability/timeline.png)

The first step is not choosing a method. The first step is deciding what question you are trying to answer.

</section>


---

<section id="map-question0" data-map-section="question0" markdown="1">

## Question 0: What system are we actually studying?

Before any interpretation, step 0 is to actually understand the model itself. Understand the theory behind the individual components. Any system can be complex, but that does not mean it is inherently impossible to understand - the first responsibility of anyone claiming interpretability is to understand the theory behind every component of the system being analyzed.

- What **data** was the model trained on?
- What **objective** was optimized?
- What **architecture** was used and why?
- What assumptions are built into the design?

Many apparent interpretability findings are consequences of these choices.

A model trained on biased data may learn biased shortcuts.  
A model trained with a different objective may learn different internal structure.

</section>

<section id="map-attribution" data-map-section="attribution" markdown="1">

---

## 1. Feature Attribution
<!-- ### Question 1: Which parts of the input are assigned credit? -->

**Attribution:** how sensitive the model's prediction is to different parts of input (features)

Attribution score is numeric measure (representation) of this sensitivity and we can visualize it for various modalities:
- tabular data: bar chart of input feature importances
* text: highlighted words/tokens
* images: heatmap (saliency map)

There are multiple ways of how to assign importance/relevance credit to the individual parts of the input: 
- information from the *gradient* (how sensitive is the ouput to a small change in the input)
- integrating gradients along a path (from baseline input to the actual input)
- approximate the effect of removing input regions

One of the truly successful neural network-based architectures were in the field of computer vision (the AlexNet moment), thus it is natural people wanted to understand the decisions behind model predictions. Why did the model predict this specific label? Why did it fail for this specific example? Is the model driven by meaningful regions, concepts within the input image? This lead to the plethora of saliency based methods, with **saliency maps** introduced by [Simonyan et al., 2013](https://arxiv.org/abs/1312.6034) (use of raw gradients). The field then further evolved:

* **Grad-CAM** ([Selvaraju et al., 2016](https://arxiv.org/abs/1610.02391)): gradient-weighted class activation mapping
* **Layerwise Relevance Propagation** ([Binder et al., 2016](https://arxiv.org/abs/1604.00825)): propagate prediction relevance backward through the net to the input
* **Integrated Gradients** ([Sundararajan et al., 2017](https://arxiv.org/abs/1703.01365)): accumulate gradients from a baseline to the input
* **DeepLIFT** ([Shrikumar et al., 2017](https://arxiv.org/abs/1704.02685)): attribute predictions by comparing neuron activations to a ref. baseline
* **LIME** ([Ribeiro et al., 2016](https://arxiv.org/abs/1602.04938)): model-agnostic = needs only inputs and outputs
* **SHAP** ([Lundberg and Lee, 2017](https://arxiv.org/abs/1705.07874)): based on [Shapley value](https://en.wikipedia.org/wiki/Shapley_value) from game theory

As you could notice, some of the methods rely on a "baseline" choice; read this well written [Distill article](https://distill.pub/2020/attribution-baselines/?utm_source=chatgpt.com) explaining the impact of feature attribution baselines.

![saliency-maps](/assets/notes/2026-06-23-ai-interpretability/saliency-maps.png)


But there was almost immediate pushback.  Does this kind of explanation truly reflect what the model computes? It is nice to see that specific areas of input are somehow relevant for the network, and some more than others. But what does it mean? This was the problem of "faithfulness".

[Adebayo et al., 2018](https://arxiv.org/abs/1810.03292) in "Sanity Checks for Saliency Maps" showed, that several popular attributions produce the same plausible-looking heatmap even after you _randomize_ the model's weights or the labels!
- this was a problem: an explanation that does not depend on the model is _not_ explaining the model

Further work by [Kindermans et al., 2017](https://arxiv.org/abs/1711.00867) in their "The (un)reliability of Saliency Methods" showed that attributions can shift under input changes that leave prediction unchanged.

This was an important lesson. The field suggested "interpretable-looking" results, often nice and intuitively looking heatmaps. But this does NOT meand the results are true! it does not mean the explanation is faitfhul to the true model reasoning.

Imagine a classification problem. We have a well-performing, trained model. We test it with an image of a dog. The model correctly predicts the class. We look at the corresponding saliency map, obtaining a heatmap which we can overlay over the image. The saliency map highlights the region of the dog's head. We might immediately think "Aha, the model is looking at the dog's face, which is why it made its prediction". This seems natural. But how do we actually know? This is exactly what Adebayo et al. studied, and showed that if the model weights were randomized, which would equal to the destruction of the learned knowledge, the explanations were often very similar to the original model results! If that is the case, the explanation was never actually telling us about the model in the first place, it was telling us something about the image.

These unpleasent findings were not limited to saliency. The field repeatedly discovered versions of the same pattern. So this is a warning not to make the same mistakes again, and again...

For example the **probing** can tell us that some information is encoded in the representation. But what it does not tell us is whether the model actually uses this information for making predictions. The probe only shows availability, not usage.

**Concept-based** interpretability methods like TCAV can tell us that this concept correlates with prediction. But is the model reasoning through that concept? Or is the concept correlated with the true causal factor? These questions are not answered.

The **prototype-based** approach can show us that this patch looks like that patch from the training examples. But does similarity fully explain the decision?

When transformer architecture became prevalent, there was a naive hope that it might offer inherent interpretability via **attention maps**. People loved attention maps, but then came "Attention is not explanation" paper, critiquing that showing where information flows is not the same thing as explaining a decision.

The deeper lesson is almost philosophical. Humans are incredibely easy to fool with explanations. We prefer coherent stories, visual explanations and simple narratives over ugly truths, uncertainty and causal evidence.

</section>

<section id="map-probing" data-map-section="probing" markdown="1">

## 2. _Probing_ the network representations to see what information is present
<!-- ## Question 2: What information is present inside the representations? -->
**Probing** a neural network means testing whether a certain information is present inside its internal representations.

[Alain and Bengio, 2016](https://arxiv.org/abs/1610.01644) used the term **probe** to represent a linear classifier. These simple models are trained on the network's internal representations (activations) to predict some property of interest (target), that can be almost anything. This also means that a probe is a _supervised_ model (we specify the target), unlike the SAE approach which is _unsupervised_. Probing originated prior to any rigorous definitions of AI interpretability, and is often considered to be a part of neural network **representation analysis**.

Further studies by [Hewitt and Manning, 2019](https://aclanthology.org/N19-1419.pdf) explored _structural probes_, assessing whether syntactic structure is present in representation geometry.

In the context of _concept-based interpretability_, [Kim et al., 2017](https://arxiv.org/abs/1711.11279) introduced Concept Activation Vectors (CAVs), which extended the pure probing to sensitivity studies and affect of concept strengths on model predictions. This work inspired [Graziani et al., 2019](https://arxiv.org/abs/1904.04520) work on Regression Concept Vectors (RCVs), extending concept vectors to _continuous_ values.

Probes:
- linear classifier
- linear regressor
- more complex probes (e.g., MLPs) which can decode something the simple probes cannot, but they can "compute" information that just was not explicitly represented and are also less interpretable (black box model analyzing black box models)

It is important to keep in mind that information _presence_ does **not** imply information _usage_. A model may encode information it never explicitly outputs.
- a language model may represent syntax
- a vision model may represent object parts
- a histology model may represent tissue patterns

Probing tests whether such information can be recovered from internal representations, not whether the information is actually causally important for the model's decision making.

The usual setup is simple:

1. take activations from a model (choose layer of interest),
2. train a small classifier on top,
3. test whether some property (target) can be decoded.

![probing](/assets/notes/2026-06-23-ai-interpretability/probing.png)
**Diode notation** for probing as proposed by [Alain and Bengio, 2016](https://arxiv.org/abs/1610.01644). The diode symbol, represents a probe, and highlights the fact that the gradients will not backpropagate through these connections. Probes are just analysis tool, and do not interfere with the model training. $\mathbf{X}$ is input, $\mathbf{\hat{Y}}_i$ is probe prediction for a given $\mathbf{H_i}$ activation in layer of interest $i$. 


Probing: What information is present?
Interventions: What information is actually _used_?

</section>

---

<section id="map-prototypes" data-map-section="prototypes" markdown="1">


## 3. Prototypes

Understanding neural networks with _prototypes_ and examples
<!-- ### Question 4: Which examples does the model compare this to? -->

**Example-based** methods: generic terms for interpretability methods explaining by training examples. The goal is to assess which examples, patches, or learned prototypes support the decision of interest.
- influence functions
- training data attribution
- prototype-based methods

**Prototype-based** methods: explaining model predictions via representative examples (prototypes).
- the goal is to make the model interpretable by design.

E.g. ProtoPNet ([Chen et al., 2018](https://arxiv.org/abs/1806.10574)): "This looks like that".
- the "this" is the part of the input of interest during inference and the "that" is the prototype learned from training data - the goal is to assess similarity between them.
- the network classifies new images by comparing image regions to the learned prototypes

This is not a classical post-hoc explanation - the comparison of image regions to the prototypes is a part of the model's own reasoning.

Prototype methods belong naturally to example-based interpretability, together with influence functions and training-data attribution.
- Which examples, patches, or learned prototypes support this decision?

</section>


<section id="map-concept-based" data-map-section="concept-based" markdown="1">

## 4. Concept-based Interpretability

Explaining the models with human-understandable _concepts_

**Concept-based interpretability** is inspired by the fact that humans typically reason in _concepts_ - abstractions of collections of things that are related in some meaningful way. Concepts can be faces, wheels, structures, but also emotions, philosophical constructs and others. In medical domain, when doctors make their diagnoses, they analyze the structures, morphology, similarities, known cell types, tissues, tumor regions, ...

Concept-based interpretability tries to connect model behavior to concepts humans can name. The key question is: Can model behavior be described in terms humans understand?

TCAV ([Kim et al., 2017](https://arxiv.org/abs/1711.11279)) asks whether a chosen concept influences a prediction.

Concept Bottleneck Models ([Koh et al., 2020](https://arxiv.org/abs/2007.04612)) go further. They first predict human-defined concepts, then predict the final label from those concepts. This makes the reasoning more transparent and inspectable.

It also allows intervention: What happens if we deliberately _change_ this concept?

</section>

<section id="map-counterfactuals" data-map-section="counterfactuals" markdown="1">

## 5. Counterfactual explanations

A different angle on interpretability - explain by what would flip the output. What would need to change for the output to change?

Counterfactual explanations ask a contrastive question. Not simply "why this output?", but rather "why this output instead of another one?".

For example: _If income were higher by this amount, the loan would be approved._

This line of work includes counterfactual explanations, actionable recourse, and DiCE.

The explanation is not a heatmap, concept, or circuit. It is a minimal change that would alter the outcome.

</section>

<section id="map-mechinterp" data-map-section="mechinterp" markdown="1">

## 6. Mechanistic Interpretability

Understanding the actual mechanisms inside neural networks - the algorithm itself

Mechanistic interpretability asks probably the most ambition question. Can we _reverse-engineer_ the model's internal computation into something human-readable?

The objects of study are weights, activations, features, circuits, and causal pathways.

The goal is not just "what input mattered?", or "what information is represented?". The goal is close to understanding what algorithm is implemented inside the network. The variables, the unknown unknowns, and their interactions. Olah drew the analogy of reverse-enginering a binary program with how we can uncover the mysteries of neural networks in his [blog post](https://www.transformer-circuits.pub/2022/mech-interp-essay).

This includes work on circuits, activation patching, superposition, and sparse autoencoders.

Sparse autoencoders (SAEs) are useful here because they may decompose dense activations into more interpretable features.

But finding features is not automatically the same as explaining the mechanism.

For a mechanistic claim, we usually need causal evidence: ablations, activation patching, interventions, or other tests showing that the proposed component actually matters for the behavior.

</section>

--- 

## X. Inherently-interpretable models
- advocated mainly by Cynthia Rudin, e.g. see [Rudin (2019)](https://arxiv.org/abs/1811.10154)

---


## References

- How to reason about AI interpretability: [Lipton (2016)](https://arxiv.org/abs/1606.03490)
- How to evaluate AI interpretability: [Doshi-Velez and Kim (2017)](https://arxiv.org/abs/1702.08608)
- Stop explaining black box models, use interpretable models instead: [Rudin (2019)](https://arxiv.org/abs/1811.10154)