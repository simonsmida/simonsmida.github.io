---
title: "The Model as Scientist"
date: 2026-01-30
categories: [notes]
excerpt: "By opening black-box bio foundational model, researchers discovered that AI relies on DNA fragment lengths to detect Alzheimer's, a signal that outperformed traditional biomarkers (methylation) and proved AI can teach us new biology."
header:
  teaser: /assets/notes/ai-scientist-thumb.png
tldr: "By opening black-box bio foundational model, researchers discovered that AI relies on DNA fragment lengths to detect Alzheimer's, a signal that outperformed traditional biomarkers (methylation) and proved AI can teach us new biology."
---

## What happens when we _listen_ to AI, instead of just using it blindly?

We should move beyond plain "black box" prediction to learning scientific insights from AI models. This post shows a promissing step in that direction. 

Research from the collaboration between [Goodfire](https://www.goodfire.ai/) and [Prima Mente](https://www.primamente.com/) demonstrated how opening the black box can lead to new knowledge. In "[Using Interpretability to Identify a Novel Class of Alzheimer's Biomarkers](https://www.goodfire.ai/research/interpretability-for-alzheimers-detection)" they described a proof-of-concept for the potential of AI interpretability-guided biomarker discovery.

## Using AI to Discover a New Alzheimer's Biomarker

![research-process](https://research-posts.s3.amazonaws.com/alzheimers-graphical-abstract.webp)

### The Goal: A Simple Blood Test for Alzheimer's

**Problem:** Diagnosing Alzheimer's Disease (AD) usually requires invasive brain scans or spinal taps. A simple blood test would be a game-changer.

**Mechanism:** Analyze [cfDNA](https://en.wikipedia.org/wiki/Circulating_free_DNA) (cell-free DNA) in blood samples. When cells die, they release tiny fragments of DNA into the bloodstream (cfDNA). These are "floating scraps" of information.

Scientists usually look at specific known markers to diagnose diseases. The **biomarker** typically looked at for AD is **methylation** - chemical "tags" on the DNA that act like on/off switches for genes. But is this the _only_ useful biomarker?

We could look into AI to find new insights, but how do we open the black box? The answer lies in interpretability techniques.


### The _Pleiades_ Foundational Model

The researchers used a _foundational model_ for biology called [Pleiades](https://www.primamente.com/Pleiades-July-2025/). It is a large, general-purpose biological model trained once at scale and reused across many tasks.

![Pleiades-architecture](https://research-posts.s3.amazonaws.com/pleiades-ad-detection.webp)

**Parameters:** 7B

**Training Data:** 1.9T tokens of human DNA sequences (genomic and cfDNA)

**Model Architecture:** Hierarchical Attention Transformer

What it can do? In simple terms, it takes raw DNA data from a blood sample and predicts if the person has Alzheimer's or not.

But knowing _that_ it works isn't enough. We need to understand _how_ it makes the decisions.

### Opening the Black Box with Interpretability

The researchers applied two distinct interpretability techniques to peek inside the model:

**1. Supervised Probing** (checking model's knowledge)
 - to assess whether the model _understands_ biological data
 - test if the model encodes known biological facts in its layers

![supervised-probing](https://research-posts.s3.amazonaws.com/alzheimers-supervised-probing.webp)

Result: Yes, they showed evidence that the model encodes both methylation and fragment length information.

**2. Unsupervised Sparse Autoencoders (SAEs)** (decomposing thoughts)
- what are the specific concepts the model _relies on_ when making disease predictions?
- SAEs are used to break down the model's complex internal representations into distinct, readable "features" (concepts)

![sparse-autoencoder](https://research-posts.s3.amazonaws.com/alzheimers-unsupervised-discovery.webp)

- **Gradient Attribution** (tracing the decision)
- which of these features (concepts) did the model _actually use_ to diagnose AD?
- the **discovery**: 
    - model relied heavily on **fragment length**
    - this was surprising because scientists typically looked for methylation markers
- the **top 9 features** from SAE were related to the specific lengths of the DNA fragments


![gradient-attribution-A](/assets/notes/unsuervised-interpretability.png)

Taking both _supervised_ and _unsupervised_ interpretability approaches together, the researchers found that methylation and fragmentomics signals are both accessible in the model. However, fragment length had a particularly prominent role in the model's AD predictions.


### But Why Did the Model Care About DNA Fragment Length?

When researchers visualized the model's internal understanding of fragment length, they found a U-shaped curve.

![u-shaped-curve](https://research-posts.s3.amazonaws.com/pleiades-fragment-manifold-extended.gif)

The model paid most attention to fragments exactly 167 base pair long. The 167 is not arbitrary - 167 base pairs is the exact length of DNA wrapped around a [nucleosome](https://en.wikipedia.org/wiki/Nucleosome) (a DNA spool) plus the little string connecting it.

The model figured out that the structure of how DNA is packed breaks down in Alzheimer's patients, leaving specific fragment sizes behind.


## Interpretability as a Tool for Hypothesis Triage

We cannot just blindly trust the model's findings. But we can use interpretability to generate new hypotheses and then validate them experimentally.

**Hypothesis:** Is _fragment length_ a valid biomarker for Alzheimer's?

To test it, researchers build an interpretable logistic regression model using only the fragment length features extracted from Pleiades.

![logistic-regression-model](https://research-posts.s3.amazonaws.com/pleiades-distillation.webp)

**Results:**
- Methylation only (Standard Science): Failed to generalize (55% accuracy on new patients).

- Fragment Length only (AI Hypothesis): Worked well (78% accuracy on new patients).

- Combined: Best performance (84% accuracy).

![results](https://research-posts.s3.amazonaws.com/alzheimers-feature-categories.webp)

Fragment length (the AI's choice) generalized to new patients better than methylation (the standard choice).


## AI as a Teacher

Listening to AI can lead to new scientific insights.

We usually use AI to _automate_ tasks. But what if we used AI to _teach_ us new things? Here, researchers used AI to _discover_ biology.

The AI saw a signal (fragmentomics) that humans had overlook, or deprioritized for Alzheimer's, and it turned out to be the stronger predictor. We should take this as a lesson: AI can help us find new directions in science if we are willing to listen.


---

**Note:** This post was based on the research: *"[Using Interpretability to Identify a Novel Class of Alzheimer's Biomarkers](https://www.goodfire.ai/research/interpretability-for-alzheimers-detection#)"* by Goodfire.ai & Prima Mente.