---
title: "A Map of AI Interpretability Research"
date: 2026-06-23
read_time: 12
hero_art: /assets/notes/2026-06-23-ai-interpretability/map-interp-hero-interactive.svg
hero_art_type: interactive
hero_alt: "Illustrated map of questions and methods in AI interpretability"
thumbnail: /assets/notes/2026-06-23-ai-interpretability/banner-map.png
thumbnail_alt: "Illustrated map of questions and methods in AI interpretability"
categories: [notes]
card_excerpt: "AI interpretability is not one problem, but a family of questions about neural networks and their behavior."
tldr: "What does it mean to 'understand' a neural network? Interpretability is a young and fragmented field, with few agreed-upon definitions. Different methods answer different questions, from what information a model represents to why it made a prediction or how it computes it internally. Interpretability is not one problem, but a family of questions we have about the model and its behavior."
header:
  teaser: /assets/notes/2026-06-23-ai-interpretability/ai-interp-hero.png
published: true
interactive_map: true
map_src: /assets/notes/2026-06-23-ai-interpretability/map-interp-hero-interactive.svg
---

**Note:** Inspiration for this article was based on the recent _[Not All Interpretability is Mechanistic](https://x.com/giangnguyen2412/status/2068743875527844200)_ blog post, which outlined the common misconception that everything related to doing "AI interpretability" automatically implies _mechanistic_ interpretability. Mechinterp is just a one branch of a larger tree, or one region of the interpretability map (above).

---

## What is there to understand about a neural network? and why is it a "black box"?


Neural networks are often described as **black boxes**. Not because we do not understand what they are made of; people design the architecture, individual components, even the training procedure and objective. We can inspect every learnable parameter, every activation at any layer of interest.

The problem is that looking at large amounts of numbers does not tell us _what the network is doing_ and for _what reasons_. It is said that neural networks as a system are not actually _designed_, but rather _grown_. The goal of a neural net is to learn to approximate a function, which is represented by an algorithm which is _unknown_ to us. We can just observe its behavior.

Interpretability and explainability (often used interchangeably) emerged as an attempt to answer what is going on in these models, how they make decisions, and when they can break and why. There is not a single answer to these questions, different subfields offer different perspectives.

---

<section id="map-question0" data-map-section="map-0" markdown="1">

### Question 0: What system are we actually studying?

Before interpretation, we need to understand the model itself.

- What data was it trained on?
- What objective was optimized?
- What architecture was used?
- What assumptions are built into the design?

Many apparent interpretability findings are consequences of these choices. The minimal first step is to ask:

> "What kind of system produced these representations in the first place?"

A model trained on biased data may learn biased shortcuts.  
A model trained with a different objective may learn different internal structure.


</section>

<section id="map-attribution" data-map-section="map-1" markdown="1">

### Question 1: Which parts of the input are assigned credit?

Attribution methods try to connect a specific prediction back to parts of the input.

For images, this often means pixels or regions.  
For language, it may mean tokens.  
For tabular data, it may mean input features.

Examples include Saliency Maps, LRP, DeepLIFT, Integrated Gradients, LIME, SHAP, and Grad-CAM.

These methods do **not** usually recover the internal algorithm of the model.

They ask a narrower question:

> Which parts of the input seem important for this output?

This distinction matters.

A heatmap can look convincing and still fail to explain the model faithfully.

Adebayo et al. showed that some saliency methods can produce similar-looking maps even after randomizing the model. That is a warning sign: if the explanation does not depend on the trained model, it is not really explaining that model.

So attribution is useful, but dangerous when treated as proof.

</section>

<section id="map-probing" data-map-section="map-2" markdown="1">

### Question 2: What information is present inside the representations?

A model may encode information it never explicitly outputs.

A language model may represent syntax.  
A vision model may represent object parts.  
A histology model may represent tissue patterns.

Probing tests whether such information can be recovered from internal representations.

The usual setup is simple:

1. take activations from a model,
2. train a small classifier on top,
3. test whether some property can be decoded.

Linear probes were used by Alain and Bengio.  
Structural probes by Hewitt and Manning studied whether syntactic structure is present in representation geometry.

Probing is internal analysis.

But it does not automatically show that the model *uses* the information.

It mainly asks:

> Is this information available in the representation?

</section>

<section id="map-concept-based" data-map-section="map-3" markdown="1">

### Question 3: Can we explain the model using human concepts?

Humans rarely think in pixels.

We think in concepts:

- edges
- faces
- wheels
- lymphocytes
- tumor regions
- necrosis

Concept-based interpretability tries to connect model behavior to concepts humans can name.

TCAV asks whether a chosen concept influences a prediction.

Concept Bottleneck Models go further.  
They first predict human-defined concepts, then predict the final label from those concepts.

This makes the reasoning more inspectable.

It also allows intervention:

> What happens if we change this concept?

The key question is:

> Can model behavior be described in terms humans understand?

</section>

<section id="map-prototypes" data-map-section="map-4" markdown="1">

### Question 4: Which examples does the model compare this to?

Sometimes the most useful explanation is not a feature.

It is an example.

Prototype methods explain predictions through similarity:

> This part looks like that prototype.

ProtoPNet is the classic example.

It learns prototypes from training data and classifies new images by comparing image regions to those prototypes.

This is different from post-hoc explanation.

The comparison is part of the model's own reasoning.

Prototype methods belong naturally to example-based interpretability, together with influence functions and training-data attribution.

The central question is:

> Which examples, patches, or learned prototypes support this decision?

</section>

<section id="map-counterfactuals" data-map-section="map-5" markdown="1">

### Question 5: What would need to change for the output to change?

Counterfactual explanations ask a contrastive question.

Not simply:

> Why this output?

But:

> Why this output instead of another one?

For example:

> If income were higher by this amount, the loan would be approved.

This line of work includes counterfactual explanations, actionable recourse, and DiCE.

The explanation is not a heatmap, concept, or circuit.

It is a minimal change that would alter the outcome.

The central question is:

> What change would flip the decision?

</section>

<section id="map-mechinterp" data-map-section="map-6" markdown="1">

### Question 6: How does the model actually compute?

Mechanistic interpretability asks the strongest question.

It tries to reverse-engineer the model's internal computation into something human-readable.

The objects of study are weights, activations, features, circuits, and causal pathways.

The goal is not just:

> What input mattered?

or:

> What information is represented?

The goal is closer to:

> What algorithm is implemented inside the network?

This includes work on circuits, activation patching, superposition, and sparse autoencoders.

Sparse autoencoders are useful here because they may decompose dense activations into more interpretable features.

But finding features is not automatically the same as explaining the mechanism.

For a mechanistic claim, we usually need causal evidence: ablations, activation patching, interventions, or other tests showing that the proposed component actually matters for the behavior.

</section>

<section id="map-interpretability" data-map-section="interpretability" markdown="1">

### The Bigger Picture

Interpretability is not one problem.

It is a family of questions.

- Attribution asks what input parts receive credit.
- Probing asks what information is represented.
- Concept methods ask whether behavior can be described using human concepts.
- Prototype methods ask which examples or patches support a decision.
- Counterfactuals ask what would change the output.
- Mechanistic interpretability asks how the computation is implemented.

These questions overlap, but they are not the same.

Most confusion comes from treating one kind of explanation as if it answered all of them.

The first step is not choosing a method.

The first step is deciding what question you are trying to answer.

</section>
