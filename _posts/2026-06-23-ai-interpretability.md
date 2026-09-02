---
title: "A Map of AI Interpretability Research"
date: 2026-06-23
last_updated: 2026-09-02
read_time: 12
hero_art: /assets/notes/2026-06-23-ai-interpretability/map-interp-hero-interactive.svg
hero_art_type: interactive
hero_alt: "Illustrated map of questions and methods in AI interpretability"
thumbnail: /assets/notes/2026-06-23-ai-interpretability/banner-map.png
thumbnail_alt: "Illustrated map of questions and methods in AI interpretability"
categories: [notes]
card_excerpt: "AI interpretability is not one problem, but a family of questions about neural networks and their behavior."
tldr: "What does it mean to 'understand' a neural network? Interpretability is a young and fragmented field, with few agreed-upon definitions. **Different methods answer different questions**, from what information a model represents to why it made a prediction or how it computes it internally. **Interpretability is not one problem, but a family of questions** we have about the model and its behavior."
header:
  teaser: /assets/notes/2026-06-23-ai-interpretability/ai-interp-hero.png
published: true
interactive_map: true
map_src: /assets/notes/2026-06-23-ai-interpretability/map-interp-hero-interactive.svg
---

**Note:** Inspiration for this article was based on the _["Not All Interpretability is Mechanistic"](https://x.com/giangnguyen2412/status/2068743875527844200)_ blog post. A common misconception is that everything related to AI interpretability automatically implies _mechanistic_ interpretability. Mechinterp is just one of the multiple existing approaches, each answering different questions.

---

## Why we do not understand neural networks?

Neural networks are often described as **black boxes**, but nothing inside them is actually hidden from us. This may seem strange: we build them ourselves, define their architecture and learning objective and can inspect every parameter and internal representation. Why, then, do even expert AI researchers say that we do not understand how they work?

The problem is that **having access to every detail does not mean understanding the system**. We design *how* neural networks learn, not *what* they learn. Training a neural network is therefore closer to *growing* something than programming it. We guide the process, but the internal solution emerges through training. What we end up with are millions or billions of learned parameters that produce useful behavior, without a description of the strategy they implement.

Interpretability and explainability (often used interchangeably) approach this mystery from multiple perspectives. We can ask what a model has learned, how it makes decisions, or when and why it fails.

---

<section id="map-question0" data-map-section="map-0" markdown="1">

### (0) Before the map: **model setup matters**

Not everything about a neural network is a mystery. We chose much of what produced the final model:

- the **data** it learned from
- the **objective** it was optimized for
- the **architecture** through which it processes information
- the **training procedure**, including preprocessing and postprocessing

These choices shape what the model learns, and thus also matter for interpretation. A classic demonstration is called the [Clever Hans effect](https://www.gutenberg.org/files/33936/33936-h/33936-h.htm): a model produces the answer for the wrong reasons. In the well-known wolf-husky example, a classifier learned to **associate snow with wolves** because wolves appeared more frequently on snowy backgrounds in the training data. Such a model can perform well on the test data too, but may fail when these spurious correlations are broken.

![Clever Hans effect illustrated with a husky](/assets/notes/2026-06-23-ai-interpretability/clever-hans.png)

**Figure 1: Clever Hans effect in the "Husky vs Wolf" experiment.** The model misclassifies a husky as a wolf because it relies on snow as an unintended shortcut rather than the animal itself. The table shows how revealing 'snow' as a potential shortcut changed participants' trust in the model ([Ribeiro et al., 2016](https://arxiv.org/abs/1602.04938)).

Now, there might be questions on what does it mean to meaningfully "remove snow" from an image, or how can we be sure model focused just on the snow. We will discuss these in Section TBD.

Similar findings are often closely tied not just to the data, but also to the objective, architecture and training procedure. They all provide important context for understanding what we can find inside.

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
