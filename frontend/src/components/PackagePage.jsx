import { Box, Button, Card, For, Stack } from "@chakra-ui/react"
import ShinyText from './styling/ShinyText.js';
import GradientText from './styling/GradientText.js';
import Particles from './styling/Particles.js';

const PackagePage = () => {
    return (
        <>
            <div style={{ width: '100%', height: '800px', position: 'relative' }}>
                <Particles
                    particleColors={['#ffffff', '#ffffff']}
                    particleCount={200}
                    particleSpread={10}
                    speed={0.1}
                    particleBaseSize={100}
                    moveParticlesOnHover={true}
                    alphaParticles={false}
                    disableRotation={false}
                />
            </div >
            <div style={{ top: "0", position: "absolute", zIndex: 1, alignItems: "center" }}>
                <GradientText
                    colors={["#ffffffff", "#929292ff", "#ffffffff", "#a1a1a1ff", "#ffffffff"]}
                    animationSpeed={3}
                    showBorder={false}
                    className="custom-class"
                >
                    <div style={{ fontSize: "2.9rem", fontWeight: "bold", padding: "30px" }}>Buy your Package!</div>
                </GradientText>
                <Stack gap="4" direction="row" wrap="wrap" padding="4" justifyContent={"center"}>
                    <For each={
                        [["Starter", 200, "Perfect for quick consultations—experience the magic of our transcriber."],
                        ["Basic", 600, "Ideal for concise, focused topic lectures."],
                        ["Standard", 1500, "Boring class? Instantly turn it into an engaging one with our free summarization."],
                        ["Pro", 4000, "Effortlessly handle multiple lectures—your stress-free solution."]]}>
                        {(variant) => (
                            <Card.Root width="320px" variant={variant} key={variant} shadow="lg" borderRadius="lg" overflow="hidden">
                                <Card.Body gap="2">
                                    {/* <Avatar.Root size="lg" shape="rounded">
                                <Avatar.Image src="https://picsum.photos/200/300" />
                                <Avatar.Fallback name="Nue Camp" />
                            </Avatar.Root> */}
                                    <Card.Title mb="2" fontWeight={"bold"} fontSize={"1.5rem"}>{variant[0]}</Card.Title>
                                    <Card.Description>
                                        {variant[2]}
                                    </Card.Description>
                                    <Box /*bg="bg" shadow="md" borderRadius="md" padding="2" mt="2" justifyItems={"center"}*/>
                                        <Card.Title>{variant[1] / .2} Words - Price: {variant[1] / 20}<span>&#2547;</span></Card.Title>
                                        <Card.Title>Token: {variant[1]}</Card.Title>
                                        <Card.Description>
                                            ~{Math.ceil(variant[1] / 32)} minutes
                                        </Card.Description>

                                    </Box>
                                </Card.Body>
                                <Card.Footer justifyContent="flex-end">
                                    <Button backgroundColor={"orange.700"} _hover={{ bg: "orange.600" }}><ShinyText text="Buy Now!" disabled={false} speed={1.7} className='custom-class' /></Button>
                                    {/* <Button>Join</Button> */}

                                </Card.Footer>
                            </Card.Root>
                        )}
                    </For>
                </Stack>

            </div>
        </>
    )
}
export default PackagePage;