---
title: "From Information to KL Divergence"
slug: from-information-to-kl-divergence
date: 2026-09-16
last_updated: 2026-09-18
layout: article
math: true
categories: [notes]
card_excerpt: "Information, surprise, entropy, cross-entropy and KL divergence."
tldr: "Information, surprise, entropy, cross-entropy and KL divergence."
published: false
topics: [information theory, entropy, KL divergence]

hero_art: /assets/notes/2026-09-16-from-information-to-kl-divergence/hero.webp
hero_art_type: image
hero_alt: "Two overlapping probability distributions with information marks scattered beneath their curves"

# Fill these in when the remaining artwork is ready:
# thumbnail: /assets/notes/2026-09-16-from-information-to-kl-divergence/thumbnail.webp
# thumbnail_alt: "TODO: Describe the thumbnail."
# thumbnail_width: 256
# thumbnail_height: 256
# social_image: /assets/notes/2026-09-16-from-information-to-kl-divergence/social.jpg
---

<!-- Draft template: replace the TODO prompts with your own writing. -->

## Introduction

<!-- TODO: Introduce the question, motivation, and scope of the article. -->
What is information? What is information theory? Diploma thesis of Claude Shannon.

Representing information with _bits_ (0 or 1). We can encode each event outcome in the form of bits. Suppose we have some magic orb black box thing, that generates outcomes, e.g. sequences of letters A, B, C and D. The magic orb might generate each letter following some (from us hidden) probability distribution, e.g. $p = (0.5, 0.25, 0.125, 0.125)$ for $(A, B, C, D)$. Now, how do we encode these letters with bits?
- we have 4 symbols, but only 2 bits - so it is natural to use more than 1 bit to represent each character
- **naive encoding** - what if we use this:
  - A = 00
  - B = 01
  - C = 10
  - D = 11

This _will_ do the work! We can encode sequences of letters, e.g. AAABCDD = 00000001101111 - and we can use our knowledge that each letter is 2 symbols, and assumption of not making any mistakes in the process, and we can decode the sequence "message". 

But Shannon realized we can do better - especially when we take into account our magic orb, which generates the secret messages with certain probabilities - some letters are more probable than others, which in practice means that we observe them more frequently if they have higher probability. We can leverage this insight, and assign fewer bits for more probable letters (to save space), and more bits to represent less probable letters, so:
- A = 0
- B = 10
- C = 110
- D = 111

So knowing the probability distribution lets us **compress** the observations.

This is useful, because now we can intuitively feel that more probable outcomes will happen more often, and thus are less suprising. And if an event outcome is very rare, it is highly informative and surprising if it happens.

Thoughts like this likely led Claude Shannon to formalizing the idea of information and surprise into an information theory. When we talk about information of an individual outcome/observation, Claude called it **self-information** and it is also named as **surprisal**. 

## Self-information (surprise)

<!-- TODO: Define and explain self-information / surprisal. -->

We intuitively arrived at a conclusion that less probable events = little info, while rare events are more informative. We could describe this with a function! We know we can ignore negative values - there is no "negative probability" nor "negative information" (eee, but for people there is), so we know we are moving in the first quadrant of Cartesian coordinate system. Now, *what properties* do we want from our function? How do probabilities behave? How should our "self-information" behave?
- For events A and B that are *independent* (occurrance of one does not effect the other) we have: 

$$
P(A, B) = P(A)\cdot P(B)
$$

- What about information? We want information to add - information(A, B) should intuitively combine information(A) and information(B), so:

$$I(A, B) = I(A) + I(B)
$$

Now, what mathematical function turns multiplication into addition? it is a **logarithm**! But we need to modify it a bit, because logarithm can produce negative values, which is not what we want. We need to invert the relationship. Use probability as input, and information as output - so the lower the probability the higher the information:

$$
I(x) = -\log p(x)
$$

And we have our first formula - the **self-information** or **surprisal** of an event outcome. It is important to highlight that this function tells us "how surprising" is just a single individual outcome. Not the overall behavior of the random event. For that we need something more general that encompassess all the potential outcomes based on their probabilities. And that something is called **entropy**.


## Entropy

<!-- TODO: Introduce entropy and explain how it relates to self-information. -->

So we arrived at the formula for self-information of a *single* event outcome to be $I(x) = -\log p(x)$. Now, how to encompass something like an "overall suprisal"? Could we just naively sum up the individual self-information values for each possible events and call it entropy? Something like:
- entropy = $\sum_x I(x)$ ... for each event outcome $x$?

This is insufficient, because it does not take into account how likely an event outcome is. Individual outcomes *do not occur equally often*. We need to make direct use of outcome probability given the probability distribution underlying our random event. This naturally leads to an **expectation value**. And lets denote entropy of event p as H(p).

$$
H(p) = E_{x \sim p}[I(x)] = E_{x \sim p}[-\log p(x)] = \sum_x p(x)[-\log p(x)]
$$

where $p(x)$ is how often $x$ occurs and $-\log p(x)$ is the surprise when $x$ occurs.

So now we have:
- self-information = info from 1 observed outcome
- entropy = expected info from outcome drawn from a probability distribution

Until now we only used a *single* underlying probability distribution. But this is often hidden from us, we do not know it precisely (which is hidden in the magic orb), but we can see the outcomes, the observations and somehow *estimate* the true distribution. This estimate will likely not be perfect, but can be good enough. We call a mechanism that estimates the true world a **model**. And we can talk about entropy in the context of both the *true* and the *model* distributions together with **cross-entropy** - "cross" between *true* and *model*.

## Cross entropy

<!-- TODO: Introduce cross entropy and explain what is being compared. -->

There is some magic orb hidden, unknown *true* distribution $p$: $x \sim p$
But if we do not know $p$, how to describe entropy of $p$? We can guess, estimate $p$ - let's call our guess $q$.

$$
H(p, q) = \sum_x p(x)[-\log q(x)]
$$

where $p(x)$ is the reality (true prob. distribution of $x$) and $q(x)$ is the prob. distribution produced by our imperfect model.

Even thought we don't explicitly know the true $p(x)$, we can and _do_ observe samples generated by it. So we have 2 options:
1. estimate p
2. average over observations 

This is how we can actually calculate the cross-entropy.

So now we have:
- $H(p)$ ... average surprise using correct $p$
- $H(p,q)$ ... average surprise using model $q$

Now we can ask - how much extra surprise (ecost for extra encoding) do we get because we use $q$ instead of true $p$? This answers KL divergence.

## KL divergence

<!-- TODO: Introduce KL divergence and its relationship to entropy and cross entropy. -->

KL divergence measures how different two probability distributions are. In our case, the 2 distributions are $p$ and $q$.

$$
D_{\mathrm{KL}}(p \Vert q) = H(p,q) - H(p) = \sum_x p(x) \log \frac{p(x)}{q(x)}
$$

Thus, the more $q$ disagrees with $p$, the larger the KL divergence. And if in some dream world the 2 distributions would equal, the KL divergence would be 0.


## Putting the pieces together

<!-- TODO: Summarize the progression from information to KL divergence. -->

Useful to keep in mind is:

$$
H(p, q) = H(p) + D_{\mathrm{KL}}(p \Vert q)
$$


<!-- TODO: Close with the main takeaway. -->
