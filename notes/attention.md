---
layout: single
title: "Attention, from first principles"
excerpt: "A first-principles, no-hype walkthrough of attention in transformers."
categories:
  - transformers
  - deep-learning
tags:
  - attention
  - transformers
  - vit
  - self-attention
  - deep-learning
classes: wide
author_profile: false
share: false
related: false
read_time: true
---

![lucifer](images/lucifer.png)

🧙🏻‍♂️: Let's try to unpack this *magic* word.

Transformer architecture is *designed* to work with *sequence* data.
Sequence = sentence of words, image of patches, ...

* elements of a sequence are not necessarily vectors; they can be *anything*!

Input sequence: $el_1, el_2, \dots el_n$ (totally *not* vectors yet)

But we use computers; we want vectors = we could do linear algebra, right?
Q: How to get vectors?
A: linear projection

Well, well, well... does this make sense? what is input to linear projection?

* it MUST be a vector even here!
* it is a RAW vector representation of an input element
* ~~raw vector elements don't necessarily need to be of same size~~ (this was bs)

  * linear projection actually requires *fixed input* dimensionality (makes sense)

Ok, so linear projection is mainly about producing *embedding* vectors from *raw* data. So they start behaving.

---

So far: $\quad el_i \to$ linear projection $\to x_i$

---

Ok, is this enough?
No. Later on for the transformer to work we would need a thing called CLS token.

But we'll get there later on.

Ok, great, we have *embeddings*, fancy word for *vectors*.
What can we do with these vectors? What do we *want* to do with the vectors??

We'd like to assess their meaning, or rather **give them meaning**.

* chatGPT KNOWS what the meaning is!
* $\to$ *“We want each vector to incorporate information from other relevant vectors.”* — chatGPT

How do they relate? How do they influence each other? How they interact?

To **give them meaning**, and a better (but what does it mean? we'll get there) one than just the recently done linear projection, we'd like to transform them again, and transform them to somewhere *meaningful*.
How? **attention**, duh... but why?

* 1 output for 1 input
* shared mechanism
* interaction

Well, let's backtrack. Attention is an operation, but it is not immediately clear why specifically we chose it.
What we want, is to asses which vectors are somehow *similar*, or *related*.
*Similar*, or *related* vectors should *interact more*.

How to assess this?

* we must **compare** the **vectors** somehow
* we want to produce some **scalar score** per vector pair, to assess them

Perfect candidate for this is dot product! And it's *cheap*, *scales well*, and is *differentiable*!
So input embeddings: $x_1, x_2, \dots x_n$
Score($i, j$) = $x_i \cdot x_j$

...eeeh.. this *should* work in principle, but is apparently not enough (but why?). Q, K, V for the rescue.

I said Q, K, V for the rescue!! Yeah, these letters. We need to role play.

From Q, K, V we want to represent distinct roles of interest:

* Decide **what** the vector **is looking for** $\to$ Q
* Decide **how** the vector **should be matched** $\to$ K
* Decide **what info should** the vector **transmit** $\to$ V

Mystical, needs *polish*ing (🇵🇱 mentioned).

Ok, not polished yet, but whatever idc now. Important thing is this: Q, K, V are **not concepts!** they are learned linear projections defining different similarity and information spaces. And I should mention that every input gets its Q, K, V vectors. Like this:

* $Q = X W_Q$
* $K = X W_K$
* $V = X W_V$

Then attention is simple, just blindly follow this formula:

$$
\mathrm{Attention}(X)
=====================

\mathrm{softmax}!\left(
\frac{Q K^\top}{\sqrt{d_k}}
\right)
V
$$

bjada. Not hard tho, we already have the Q, K, V there, and $d_k$ is some obscure constant which absolutely makes sense there (no but seriously, it helps keep things more stable, for the softmax).

Ok, let's backtrack again a bit. The QK product, along with the softmax result, produces *weights* (how much similar tokens are), so that we can *weigh* each individual V elements.

In the end, attention comes down to this:

* input vectors (sequence) $\to$ **attention** $\to$ sequence *with contextual information*

So we done? Basically. But not practically.

What we've done is called single self-attention. But this is ~~weak~~ limited to 1 similarity space. It learns just a *single* similarity space. *Single* notion of relevance. We want to do better. Why not do it *multiple* times, to get *multiple* notions of relevance, to get different similarity metrics?? and do it in parallel?? Yeah, that's multi-head attention.

So that I'm totally cooked, apparently I omitted the most important thing I should mention. Thanks chatGPT again. So here it is:

> **“Note that attention alone is permutation-invariant, so positional information must be added separately.”** — chatGPT banger
